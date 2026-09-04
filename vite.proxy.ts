import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
// @ts-expect-error JS module — typed via loadEnv.mjs.d.ts (NodeNext)
import { loadEnv } from './loadEnv.mjs'

loadEnv()
// @ts-expect-error JS module — typed via aiSynthesize.mjs.d.ts (NodeNext)
import { handleAiSynthesize } from './aiSynthesize.mjs'
// @ts-expect-error JS module
import { getCachedEntityProfile, handleAiEntityProfile } from './aiEntityProfile.mjs'

const UA = 'Ontopedian/1.0 (https://github.com/moktarul12/ontara; ontology-demo)'

const UPSTREAM = {
  wikidataSparql: 'https://query.wikidata.org/sparql',
  dbpediaSparql: 'https://dbpedia.org/sparql',
  yagoSparql: 'https://yago-knowledge.org/sparql/qlever',
  wikidataApi: 'https://www.wikidata.org/w/api.php',
} as const

function wikipediaRestBase(lang: string): string {
  return `https://${lang}.wikipedia.org/api/rest_v1`
}

function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function pipeUpstream(
  upstreamUrl: string,
  req: IncomingMessage,
  res: ServerResponse,
  opts?: { method?: string; body?: Buffer; contentType?: string },
) {
  try {
    const headers: Record<string, string> = {
      Accept: req.headers.accept || 'application/json',
      'User-Agent': UA,
    }
    if (opts?.body && opts.contentType) {
      headers['Content-Type'] = opts.contentType
    }

    const upstreamRes = await fetch(upstreamUrl, {
      method: opts?.method || req.method || 'GET',
      headers,
      body: opts?.body,
    })

    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.statusCode = upstreamRes.status
    res.end(Buffer.from(await upstreamRes.arrayBuffer()))
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[ontopedian-proxy]', upstreamUrl, detail)
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(
      JSON.stringify({
        error: 'Upstream proxy failed',
        detail,
        hint:
          detail.includes('ENOTFOUND') || detail.includes('getaddrinfo')
            ? 'DNS cannot resolve Wikidata. Restart npm run dev in your own terminal (not the agent sandbox).'
            : undefined,
      }),
    )
  }
}

/**
 * Same-origin proxies for local Vite:
 *   /api/wikidata?*  → https://www.wikidata.org/w/api.php?*
 *   /sparql/wikidata → https://query.wikidata.org/sparql
 *   /sparql/dbpedia  → https://dbpedia.org/sparql
 *   /sparql/yago     → https://yago-knowledge.org/sparql/qlever
 */
export function ontaraDevProxy(): Plugin {
  return {
    name: 'ontara-dev-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const raw = req.url || ''
        if (
          !raw.startsWith('/api/wikidata') &&
          !raw.startsWith('/api/wikipedia') &&
          !raw.startsWith('/api/mediawiki') &&
          !raw.startsWith('/api/ai/') &&
          !raw.startsWith('/api/entity/') &&
          !raw.startsWith('/sparql')
        ) {
          next()
          return
        }

        // Bundled overview shell — /api/entity/Q123/shell
        if (raw.startsWith('/api/entity/') && raw.includes('/shell')) {
          const incoming = new URL(raw, 'http://localhost')
          const parts = incoming.pathname.split('/').filter(Boolean)
          const qid = (parts[2] || '').toUpperCase()
          const lang = incoming.searchParams.get('lang') || 'en'
          if (!/^Q\d+$/.test(qid)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid Q-id' }))
            return
          }
          try {
            const wdUrl = new URL(UPSTREAM.wikidataApi)
            wdUrl.searchParams.set('action', 'wbgetentities')
            wdUrl.searchParams.set('ids', qid)
            wdUrl.searchParams.set('props', 'claims|labels|descriptions|sitelinks')
            wdUrl.searchParams.set('languages', `${lang}|en`)
            wdUrl.searchParams.set('format', 'json')

            const wdRes = await fetch(wdUrl.toString(), {
              headers: { 'User-Agent': UA, Accept: 'application/json' },
            })
            const wdJson = (await wdRes.json()) as {
              entities?: Record<
                string,
                { sitelinks?: Record<string, { title?: string }> }
              >
            }
            const entity = wdJson?.entities?.[qid]
            const wikiTitle =
              entity?.sitelinks?.[`${lang}wiki`]?.title ??
              entity?.sitelinks?.enwiki?.title ??
              null

            let wiki: Record<string, unknown> | null = null
            if (wikiTitle) {
              const encoded = encodeURIComponent(wikiTitle.replace(/ /g, '_'))
              const summaryUrl = `${wikipediaRestBase(lang)}/page/summary/${encoded}`
              const tocUrl = new URL(`https://${lang}.wikipedia.org/w/api.php`)
              tocUrl.searchParams.set('action', 'parse')
              tocUrl.searchParams.set('page', wikiTitle)
              tocUrl.searchParams.set('prop', 'sections')
              tocUrl.searchParams.set('format', 'json')
              const introUrl = new URL(`https://${lang}.wikipedia.org/w/api.php`)
              introUrl.searchParams.set('action', 'parse')
              introUrl.searchParams.set('page', wikiTitle)
              introUrl.searchParams.set('section', '0')
              introUrl.searchParams.set('prop', 'text')
              introUrl.searchParams.set('formatversion', '2')
              introUrl.searchParams.set('format', 'json')

              const [summaryRes, tocRes, introRes] = await Promise.all([
                fetch(summaryUrl, {
                  headers: { 'User-Agent': UA, Accept: 'application/json' },
                }),
                fetch(tocUrl.toString(), {
                  headers: { 'User-Agent': UA, Accept: 'application/json' },
                }),
                fetch(introUrl.toString(), {
                  headers: { 'User-Agent': UA, Accept: 'application/json' },
                }),
              ])

              wiki = {
                summary: summaryRes.ok ? await summaryRes.json() : null,
                toc: tocRes.ok ? await tocRes.json() : null,
                intro: introRes.ok ? await introRes.json() : null,
                title: wikiTitle,
                lang,
              }
            }

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ qid, lang, wikidata: wdJson, wiki }))
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err)
            res.statusCode = 502
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Entity shell failed', detail }))
          }
          return
        }

        if (raw.startsWith('/api/ai/entity/')) {
          const incoming = new URL(raw, 'http://localhost')
          const qid = incoming.pathname.split('/').pop() ?? ''
          const method = (req.method || 'GET').toUpperCase()

          if (method === 'GET') {
            try {
              const cached = await getCachedEntityProfile(qid)
              if (!cached) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ cached: false }))
                return
              }
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(cached))
            } catch (err) {
              const detail = err instanceof Error ? err.message : String(err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI cache read failed', detail }))
            }
            return
          }

          if (method === 'POST') {
            try {
              const body = JSON.parse((await readRequestBody(req)).toString('utf8'))
              const result = await handleAiEntityProfile({ ...body, qid: body.qid ?? qid })
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(result))
            } catch (err) {
              const detail = err instanceof Error ? err.message : String(err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'AI entity profile failed', detail }))
            }
            return
          }

          res.statusCode = 405
          res.end('Method not allowed')
          return
        }

        if (raw.startsWith('/api/ai/synthesize')) {
          if ((req.method || 'GET').toUpperCase() !== 'POST') {
            res.statusCode = 405
            res.end('Method not allowed')
            return
          }
          try {
            const body = JSON.parse((await readRequestBody(req)).toString('utf8'))
            const result = await handleAiSynthesize(body)
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(result))
          } catch (err) {
            const detail = err instanceof Error ? err.message : String(err)
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'AI synthesis failed', detail }))
          }
          return
        }

        // MediaWiki API — /api/mediawiki/en?action=parse&...
        if (raw.startsWith('/api/mediawiki/')) {
          const incoming = new URL(raw, 'http://localhost')
          const parts = incoming.pathname.split('/').filter(Boolean)
          const lang = parts[2]
          if (!lang) {
            res.statusCode = 400
            res.end('Bad MediaWiki proxy path')
            return
          }
          const upstream = new URL(`https://${lang}.wikipedia.org/w/api.php`)
          incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))
          await pipeUpstream(upstream.toString(), req, res, { method: 'GET' })
          return
        }

        // Wikipedia REST API — /api/wikipedia/en/page/summary/Title
        if (raw.startsWith('/api/wikipedia/')) {
          const incoming = new URL(raw, 'http://localhost')
          const parts = incoming.pathname.split('/').filter(Boolean)
          const lang = parts[2]
          const restPath = parts.slice(3).join('/')
          if (!lang || !restPath) {
            res.statusCode = 400
            res.end('Bad Wikipedia proxy path')
            return
          }
          const upstream = `${wikipediaRestBase(lang)}/${restPath}${incoming.search}`
          await pipeUpstream(upstream, req, res, { method: 'GET' })
          return
        }

        // Wikidata MediaWiki search API
        if (raw.startsWith('/api/wikidata')) {
          const incoming = new URL(raw, 'http://localhost')
          const upstream = new URL(UPSTREAM.wikidataApi)
          incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))
          await pipeUpstream(upstream.toString(), req, res, { method: 'GET' })
          return
        }

        // SPARQL endpoints
        let sparqlTarget: string | null = null
        if (raw.startsWith('/sparql/wikidata')) sparqlTarget = UPSTREAM.wikidataSparql
        else if (raw.startsWith('/sparql/dbpedia')) sparqlTarget = UPSTREAM.dbpediaSparql
        else if (raw.startsWith('/sparql/yago')) sparqlTarget = UPSTREAM.yagoSparql
        else if (raw === '/sparql' || raw.startsWith('/sparql?')) {
          sparqlTarget = UPSTREAM.dbpediaSparql
        }

        if (!sparqlTarget) {
          next()
          return
        }

        const method = (req.method || 'GET').toUpperCase()
        if (method === 'GET') {
          const incoming = new URL(raw, 'http://localhost')
          const upstream = new URL(sparqlTarget)
          incoming.searchParams.forEach((v, k) => upstream.searchParams.set(k, v))
          await pipeUpstream(upstream.toString(), req, res, { method: 'GET' })
          return
        }

        if (method === 'POST') {
          const body = await readRequestBody(req)
          await pipeUpstream(sparqlTarget, req, res, {
            method: 'POST',
            body,
            contentType:
              req.headers['content-type'] || 'application/x-www-form-urlencoded',
          })
          return
        }

        res.statusCode = 405
        res.end('Method not allowed')
      })
    },
  }
}
