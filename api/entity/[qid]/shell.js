import { UA } from '../../_lib/proxy.js'

export const config = {
  maxDuration: 20,
}

/**
 * Bundled overview shell — Wikidata claims + Wikipedia lead in one round trip.
 * Path: /api/entity/:qid/shell
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    if (typeof res.status === 'function') {
      res.status(405).json({ error: 'Method not allowed' })
    } else {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Method not allowed' }))
    }
    return
  }

  try {
    const qid = String(req.query.qid || '').toUpperCase()
    const lang = String(req.query.lang || 'en')
    if (!/^Q\d+$/.test(qid)) {
      const payload = { error: 'Invalid Q-id' }
      if (typeof res.status === 'function') res.status(400).json(payload)
      else {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(payload))
      }
      return
    }

    const wdUrl = new URL('https://www.wikidata.org/w/api.php')
    wdUrl.searchParams.set('action', 'wbgetentities')
    wdUrl.searchParams.set('ids', qid)
    wdUrl.searchParams.set('props', 'claims|labels|descriptions|sitelinks')
    wdUrl.searchParams.set('languages', `${lang}|en`)
    wdUrl.searchParams.set('format', 'json')

    const wdRes = await fetch(wdUrl, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    const wdJson = await wdRes.json()
    const entity = wdJson?.entities?.[qid]
    const wikiTitle =
      entity?.sitelinks?.[`${lang}wiki`]?.title ?? entity?.sitelinks?.enwiki?.title ?? null

    let wiki = null
    if (wikiTitle) {
      const encoded = encodeURIComponent(wikiTitle.replace(/ /g, '_'))
      const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`
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
        fetch(summaryUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
        fetch(tocUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
        fetch(introUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } }),
      ])

      wiki = {
        summary: summaryRes.ok ? await summaryRes.json() : null,
        toc: tocRes.ok ? await tocRes.json() : null,
        intro: introRes.ok ? await introRes.json() : null,
        title: wikiTitle,
        lang,
      }
    }

    const payload = { qid, lang, wikidata: wdJson, wiki }
    if (typeof res.status === 'function') {
      res.status(200).json(payload)
    } else {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
    }
  } catch (err) {
    console.error('Entity shell proxy error', err)
    const payload = {
      error: 'Entity shell failed',
      detail: err instanceof Error ? err.message : String(err),
    }
    if (typeof res.status === 'function') {
      res.status(502).json(payload)
    } else {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(payload))
    }
  }
}
