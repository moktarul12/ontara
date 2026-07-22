import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 1901
const UA = 'Ontara/1.0 (https://github.com/moktarul12/ontara; ontology-demo)'

const UPSTREAMS = {
  dbpedia: process.env.SPARQL_UPSTREAM_DBPEDIA || 'https://dbpedia.org/sparql',
  wikidata: process.env.SPARQL_UPSTREAM_WIKIDATA || 'https://query.wikidata.org/sparql',
}

const app = express()

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

async function proxySparql(upstreamUrl, req, res) {
  try {
    const upstream = new URL(upstreamUrl)

    if (req.method === 'GET') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') upstream.searchParams.set(k, v)
      }
    }

    const headers = {
      Accept: req.headers.accept || 'application/sparql-results+json',
      'User-Agent': UA,
    }

    let body
    if (req.method === 'POST') {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      body = Buffer.concat(chunks)
      if (req.headers['content-type']) {
        headers['Content-Type'] = req.headers['content-type']
      }
    }

    const upstreamRes = await fetch(upstream, {
      method: req.method === 'POST' ? 'POST' : 'GET',
      headers,
      body: req.method === 'POST' ? body : undefined,
    })

    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.status(upstreamRes.status)
    res.send(Buffer.from(await upstreamRes.arrayBuffer()))
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
app.all('/sparql', (req, res) => proxySparql(UPSTREAMS.dbpedia, req, res))

/** Fast entity search — Wikidata MediaWiki API */
app.get('/api/wikidata', async (req, res) => {
  try {
    const upstream = new URL('https://www.wikidata.org/w/api.php')
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') upstream.searchParams.set(k, v)
    }
    const upstreamRes = await fetch(upstream, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    const contentType = upstreamRes.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.status(upstreamRes.status)
    res.send(Buffer.from(await upstreamRes.arrayBuffer()))
  } catch (err) {
    console.error('Wikidata API proxy error', err)
    res.status(502).json({
      error: 'Wikidata API proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }))

app.get('/{*spaPath}', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Ontara listening on :${PORT}`)
})
