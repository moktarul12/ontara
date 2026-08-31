import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from './loadEnv.mjs'

loadEnv()
import { handleAiSynthesize } from './aiSynthesize.mjs'
import { getCachedEntityProfile, handleAiEntityProfile } from './aiEntityProfile.mjs'
import {
  cachedUpstream,
  cacheKeyFromSparql,
  cacheKeyFromUrl,
  cacheStats,
  TTL,
} from './apiCache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 1901
const UA = 'Ontopedian/1.0 (https://github.com/moktarul12/ontara; ontology-demo)'

const UPSTREAMS = {
  dbpedia: process.env.SPARQL_UPSTREAM_DBPEDIA || 'https://dbpedia.org/sparql',
  wikidata: process.env.SPARQL_UPSTREAM_WIKIDATA || 'https://query.wikidata.org/sparql',
  yago: process.env.SPARQL_UPSTREAM_YAGO || 'https://yago-knowledge.org/sparql/qlever',
}

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, cache: cacheStats() })
})

function sendCached(res, pack) {
  if (pack.contentType) res.setHeader('Content-Type', pack.contentType)
  res.setHeader('X-Cache', pack.cacheHit ?? 'MISS')
  res.status(pack.status)
  res.send(pack.body)
}

async function proxySparql(upstreamUrl, req, res) {
  try {
    const upstream = new URL(upstreamUrl)

    if (req.method === 'GET') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') upstream.searchParams.set(k, v)
      }
    }

    let body
    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      body = Buffer.concat(chunks)
    }

    const cacheKey = cacheKeyFromSparql(req.method, upstream, body)
    const headers = {
      Accept: req.headers.accept || 'application/sparql-results+json',
      'User-Agent': UA,
    }

    const pack = await cachedUpstream(
      cacheKey,
      TTL.sparql,
      async () => {
        const fetchHeaders = { ...headers }
        if (req.method === 'POST' && req.headers['content-type']) {
          fetchHeaders['Content-Type'] = req.headers['content-type']
        }
        return fetch(upstream, {
          method: req.method === 'POST' ? 'POST' : 'GET',
          headers: fetchHeaders,
          body: req.method === 'POST' ? body : undefined,
        })
      },
      { isSparql: true },
    )

    sendCached(res, pack)
  } catch (err) {
    console.error('SPARQL proxy error', err)
    res.status(502).json({
      error: 'SPARQL proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}

app.all('/sparql/wikidata', (req, res) => proxySparql(UPSTREAMS.wikidata, req, res))
app.all('/sparql/dbpedia', (req, res) => proxySparql(UPSTREAMS.dbpedia, req, res))
app.all('/sparql/yago', (req, res) => proxySparql(UPSTREAMS.yago, req, res))
app.all('/sparql', (req, res) => proxySparql(UPSTREAMS.dbpedia, req, res))

/** AI narrative synthesis — OpenAI when OPENAI_API_KEY is set, else rule-based */
app.post('/api/ai/synthesize', async (req, res) => {
  try {
    const body = req.body
    if (!body?.label || !body?.kind) {
      res.status(400).json({ error: 'label and kind required' })
      return
    }
    const result = await handleAiSynthesize(body)
    res.json(result)
  } catch (err) {
    console.error('AI synthesize error', err)
    res.status(500).json({
      error: 'AI synthesis failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/** Full entity AI profile — cached to data/ai-cache/Q{id}.json */
app.get('/api/ai/entity/:qid', async (req, res) => {
  try {
    const cached = await getCachedEntityProfile(req.params.qid)
    if (!cached) {
      res.status(404).json({ cached: false })
      return
    }
    res.json(cached)
  } catch (err) {
    console.error('AI entity cache read error', err)
    res.status(500).json({
      error: 'Failed to read AI cache',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

app.post('/api/ai/entity/:qid', async (req, res) => {
  try {
    const qid = req.params.qid
    const body = { ...req.body, qid: req.body?.qid ?? qid }
    if (!body?.label || !body?.kind) {
      res.status(400).json({ error: 'label and kind required' })
      return
    }
    const result = await handleAiEntityProfile(body)
    res.json(result)
  } catch (err) {
    console.error('AI entity profile error', err)
    res.status(500).json({
      error: 'AI entity profile failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/**
 * Fast bundled overview shell — Wikidata claims + Wikipedia lead in one round trip.
 * Server runs upstream calls in parallel with cache.
 */
app.get('/api/entity/:qid/shell', async (req, res) => {
  const qid = String(req.params.qid || '').toUpperCase()
  const lang = String(req.query.lang || 'en')
  if (!/^Q\d+$/.test(qid)) {
    res.status(400).json({ error: 'Invalid Q-id' })
    return
  }

  try {
    const wdUrl = new URL('https://www.wikidata.org/w/api.php')
    wdUrl.searchParams.set('action', 'wbgetentities')
    wdUrl.searchParams.set('ids', qid)
    wdUrl.searchParams.set('props', 'claims|labels|descriptions|sitelinks')
    wdUrl.searchParams.set('languages', `${lang}|en`)
    wdUrl.searchParams.set('format', 'json')

    const wdKey = cacheKeyFromUrl(wdUrl)
    const wdPack = await cachedUpstream(wdKey, TTL.wikidata, () =>
      fetch(wdUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
    )

        if (wdPack.status >= 400) {
          res.status(wdPack.status).send(wdPack.body)
          return
        }

    const wdJson = JSON.parse(wdPack.body.toString('utf8'))
    const entity = wdJson?.entities?.[qid]
    const siteKey = `${lang}wiki`
    const wikiTitle =
      entity?.sitelinks?.[siteKey]?.title ?? entity?.sitelinks?.enwiki?.title ?? null

    let wiki = null
    if (wikiTitle) {
      const encoded = encodeURIComponent(wikiTitle.replace(/ /g, '_'))
      const summaryUrl = new URL(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`)
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

      const [summaryPack, tocPack, introPack] = await Promise.all([
        cachedUpstream(cacheKeyFromUrl(summaryUrl), TTL.wikipedia, () =>
          fetch(summaryUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
        ),
        cachedUpstream(cacheKeyFromUrl(tocUrl), TTL.mediawiki, () =>
          fetch(tocUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
        ),
        cachedUpstream(cacheKeyFromUrl(introUrl), TTL.mediawiki, () =>
          fetch(introUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
        ),
      ])

      wiki = {
        summary: summaryPack.ok ? JSON.parse(summaryPack.body.toString('utf8')) : null,
        toc: tocPack.ok ? JSON.parse(tocPack.body.toString('utf8')) : null,
        intro: introPack.ok ? JSON.parse(introPack.body.toString('utf8')) : null,
        title: wikiTitle,
        lang,
      }
    }

    res.setHeader('X-Cache', wdPack.cacheHit)
    res.json({ qid, lang, wikidata: wdJson, wiki })
  } catch (err) {
    console.error('Entity shell error', err)
    res.status(502).json({
      error: 'Entity shell failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/** Fast entity search — Wikidata MediaWiki API */
app.get('/api/wikidata', async (req, res) => {
  try {
    const upstream = new URL('https://www.wikidata.org/w/api.php')
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') upstream.searchParams.set(k, v)
    }
    const cacheKey = cacheKeyFromUrl(upstream)
    const pack = await cachedUpstream(cacheKey, TTL.wikidata, () =>
      fetch(upstream, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
    )
    sendCached(res, pack)
  } catch (err) {
    console.error('Wikidata API proxy error', err)
    res.status(502).json({
      error: 'Wikidata API proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/** MediaWiki API — /api/mediawiki/:lang */
app.use(async (req, res, next) => {
  const match = req.path.match(/^\/api\/mediawiki\/([^/]+)$/)
  if (!match || req.method !== 'GET') {
    next()
    return
  }
  try {
    const lang = match[1]
    const upstream = new URL(`https://${lang}.wikipedia.org/w/api.php`)
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') upstream.searchParams.set(k, v)
    }
    const cacheKey = cacheKeyFromUrl(upstream)
    const pack = await cachedUpstream(cacheKey, TTL.mediawiki, () =>
      fetch(upstream, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
    )
    sendCached(res, pack)
  } catch (err) {
    console.error('MediaWiki API proxy error', err)
    res.status(502).json({
      error: 'MediaWiki API proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

/** Wikipedia REST API — /api/wikipedia/:lang/... */
app.use(async (req, res, next) => {
  const match = req.path.match(/^\/api\/wikipedia\/([^/]+)\/(.+)$/)
  if (!match || req.method !== 'GET') {
    next()
    return
  }
  try {
    const lang = match[1]
    const rest = match[2]
    const upstream = new URL(`https://${lang}.wikipedia.org/api/rest_v1/${rest}`)
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') upstream.searchParams.set(k, v)
    }
    const cacheKey = cacheKeyFromUrl(upstream)
    const pack = await cachedUpstream(cacheKey, TTL.wikipedia, () =>
      fetch(upstream, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
    )
    sendCached(res, pack)
  } catch (err) {
    console.error('Wikipedia API proxy error', err)
    res.status(502).json({
      error: 'Wikipedia API proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

app.use(express.static(dist, { index: 'index.html', maxAge: 0 }))

app.get('/{*spaPath}', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Ontopedian listening on :${PORT}`)
})
