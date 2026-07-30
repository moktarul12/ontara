const UA = 'Ontara/1.0 (https://github.com/moktarul12/ontara; ontology-demo)'

export const UPSTREAMS = {
  dbpedia: process.env.SPARQL_UPSTREAM_DBPEDIA || 'https://dbpedia.org/sparql',
  wikidata: process.env.SPARQL_UPSTREAM_WIKIDATA || 'https://query.wikidata.org/sparql',
  yago: process.env.SPARQL_UPSTREAM_YAGO || 'https://yago-knowledge.org/sparql/qlever',
}

export function readBody(req) {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return undefined
  }
  const raw = req.body
  if (raw == null) return undefined
  if (typeof raw === 'string' || Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'object') {
    return new URLSearchParams(
      Object.entries(raw).flatMap(([k, v]) => {
        if (v == null) return []
        if (Array.isArray(v)) return v.map((item) => [k, String(item)])
        return [[k, String(v)]]
      }),
    ).toString()
  }
  return String(raw)
}

export async function proxySparql(upstreamUrl, req, res) {
  try {
    const upstream = new URL(upstreamUrl)

    if (req.method === 'GET') {
      for (const [k, v] of Object.entries(req.query || {})) {
        if (k === 'source') continue
        if (typeof v === 'string') upstream.searchParams.set(k, v)
      }
    }

    const headers = {
      Accept: req.headers.accept || 'application/sparql-results+json',
      'User-Agent': UA,
    }

    const body = readBody(req)
    if (body != null) {
      headers['Content-Type'] =
        req.headers['content-type'] || 'application/x-www-form-urlencoded'
    }

    const upstreamRes = await fetch(upstream, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? body : undefined,
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
    console.error('SPARQL proxy error', err)
    const payload = {
      error: 'SPARQL proxy failed',
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

export { UA }
