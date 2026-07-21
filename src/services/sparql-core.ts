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

export async function runSparql(
  endpoint: string,
  query: string,
  timeoutMs = REQUEST_MS,
): Promise<SparqlBinding[]> {
  const base = resolveEndpoint(endpoint)
  const url = new URL(base, window.location.origin)
  url.searchParams.set('query', query)
  url.searchParams.set('format', 'json')

  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/sparql-results+json' },
      signal: ctrl.signal,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`SPARQL ${res.status}: ${text.slice(0, 200) || res.statusText}`)
    }

    const data = (await res.json()) as SparqlResponse
    return data.results?.bindings ?? []
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('SPARQL request timed out — try a smaller expand or another node.')
    }
    throw err
  } finally {
    window.clearTimeout(timer)
  }
}
