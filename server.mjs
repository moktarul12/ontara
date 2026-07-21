import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT) || 1901
const SPARQL_UPSTREAM = process.env.SPARQL_UPSTREAM || 'https://dbpedia.org/sparql'

const app = express()

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true })
})

/** Same-origin SPARQL proxy — required because DBpedia blocks browser CORS. */
app.all('/sparql', async (req, res) => {
  try {
    const upstream = new URL(SPARQL_UPSTREAM)

    if (req.method === 'GET') {
      for (const [k, v] of Object.entries(req.query)) {
        if (typeof v === 'string') upstream.searchParams.set(k, v)
      }
    }

    const headers = {
      Accept: req.headers.accept || 'application/sparql-results+json',
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
    const buf = Buffer.from(await upstreamRes.arrayBuffer())
    res.send(buf)
  } catch (err) {
    console.error('SPARQL proxy error', err)
    res.status(502).json({
      error: 'SPARQL proxy failed',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
})

app.use(express.static(dist, { index: 'index.html', maxAge: '1h' }))

// Express 5: named wildcard (bare '*' throws PathError)
app.get('/{*spaPath}', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Ontara listening on :${PORT}`)
})
