const REQUEST_MS = 12000

export function localName(uri: string): string {
  if (!uri) return ''
  try {
    const decoded = decodeURIComponent(uri)
    const hash = decoded.split('#').pop()
    const slash = (hash ?? decoded).split('/').pop()
    return (slash ?? decoded).replace(/_/g, ' ')
  } catch {
    return uri.split(/[#/]/).pop() ?? uri
  }
}

export function predicateLabel(uri: string): string {
  return localName(uri)
}

export function isWikidataEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('wikidata.org') ||
    endpoint.includes('/sparql/wikidata') ||
    endpoint === '/sparql/wikidata'
  )
}

export function isDbpediaEndpoint(endpoint: string): boolean {
  return (
    endpoint.includes('dbpedia.org') ||
    endpoint.includes('/sparql/dbpedia') ||
    endpoint === '/sparql' ||
    endpoint === '/sparql/dbpedia'
  )
}

export function resolveEndpoint(endpoint: string): string {
  if (isWikidataEndpoint(endpoint)) return '/sparql/wikidata'
  if (isDbpediaEndpoint(endpoint) || endpoint.includes('dbpedia.org/sparql')) {
    return '/sparql/dbpedia'
  }
  return endpoint
}

export interface SparqlBinding {
  [key: string]: { type: string; value: string; 'xml:lang'?: string; datatype?: string }
}

interface SparqlResponse {
  results?: { bindings: SparqlBinding[] }
}

/** POST SPARQL — required so Vite pathRewrite cannot strip the query string. */
export async function runSparql(
  endpoint: string,
  query: string,
  timeoutMs = REQUEST_MS,
): Promise<SparqlBinding[]> {
  const base = resolveEndpoint(endpoint)
  const url = new URL(base, window.location.origin)

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const body = new URLSearchParams()
    body.set('query', query)
    body.set('format', 'json')

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/sparql-results+json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
      signal: ctrl.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`SPARQL ${res.status}: ${text.slice(0, 200) || res.statusText}`)
    }

    const data = (await res.json()) as SparqlResponse
    if (!data.results?.bindings) {
      throw new Error('SPARQL returned no results (check proxy / endpoint)')
    }
    return data.results.bindings
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('SPARQL request timed out — try a smaller expand or another node.')
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}

/** Fast Wikidata entity search via MediaWiki API (not SPARQL). */
export async function searchWikidataApi(
  term: string,
  limit = 12,
): Promise<Array<{ id: string; label: string; description?: string }>> {
  const q = term.trim()
  if (!q) return []

  const url = new URL('/api/wikidata', window.location.origin)
  url.searchParams.set('action', 'wbsearchentities')
  url.searchParams.set('search', q)
  url.searchParams.set('language', 'en')
  url.searchParams.set('uselang', 'en')
  url.searchParams.set('type', 'item')
  url.searchParams.set('limit', String(Math.min(limit, 20)))
  url.searchParams.set('format', 'json')
  url.searchParams.set('origin', '*')

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), 8000)

  try {
    const res = await fetch(url.toString(), { signal: ctrl.signal })
    if (!res.ok) throw new Error(`Wikidata search ${res.status}`)
    const data = (await res.json()) as {
      search?: Array<{ id: string; label: string; description?: string }>
    }
    return data.search ?? []
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Search timed out')
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}
