import type { SparqlSourceId } from '../types/ontology'

/** Shareable hash: `#/Q42` (Wikidata) or `#/e/<encoded-uri>`. */
export function hashForEntity(uri: string, source: SparqlSourceId): string {
  if (source === 'wikidata') {
    const m = uri.match(/\/entity\/(Q\d+)$/i)
    if (m) return `#/${m[1]}`
  }
  return `#/e/${encodeURIComponent(uri)}`
}

export function entityFromHash(
  hash: string,
  source: SparqlSourceId,
): string | null {
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw) return null

  if (raw.startsWith('e/')) {
    try {
      return decodeURIComponent(raw.slice(2))
    } catch {
      return null
    }
  }

  const qid = raw.match(/^(Q\d+)$/i)
  if (qid) {
    if (source === 'wikidata') {
      return `http://www.wikidata.org/entity/${qid[1].toUpperCase()}`
    }
    return null
  }

  return null
}
