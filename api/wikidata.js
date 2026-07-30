import { UA } from './_lib/proxy.js'

export const config = {
  maxDuration: 15,
}

/** Proxied Wikidata MediaWiki search API. */
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
    const upstream = new URL('https://www.wikidata.org/w/api.php')
    for (const [k, v] of Object.entries(req.query || {})) {
      if (typeof v === 'string') upstream.searchParams.set(k, v)
    }

    const upstreamRes = await fetch(upstream, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })

    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)

    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    if (typeof res.status === 'function') {
      res.status(upstreamRes.status).send(buf)
    } else {
      res.statusCode = upstreamRes.status
      res.end(buf)
    }
  } catch (err) {
    console.error('Wikidata API proxy error', err)
    const payload = {
      error: 'Wikidata API proxy failed',
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
