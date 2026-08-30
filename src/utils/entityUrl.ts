import type { SparqlSourceId } from '../types/ontology'

/** Stable key for matching entity URIs (Wikidata Q-id or full URI). */
export function entityKey(uri: string): string {
  const m = uri.match(/\/entity\/(Q\d+)$/i) ?? uri.match(/^(Q\d+)$/i)
  if (m) return m[1].toUpperCase()
  return uri.trim()
}

export function entityUrisMatch(a: string, b: string): boolean {
  return entityKey(a) === entityKey(b)
}

/** Normalize to canonical URI for the active source. */
export function canonicalEntityUri(uri: string, source: SparqlSourceId): string {
  const key = entityKey(uri)
  if (/^Q\d+$/i.test(key) && source === 'wikidata') {
    return `http://www.wikidata.org/entity/${key}`
  }
  return uri.trim()
}

/** Shareable hash: `#/Q42`, `#/Q42/career`, `#/e/<encoded-uri>`, or `#/map/<snapshotId>`. */
export function hashForEntity(
  uri: string,
  source: SparqlSourceId,
  overviewSection?: string,
): string {
  let base: string
  if (source === 'wikidata') {
    const m = uri.match(/\/entity\/(Q\d+)$/i)
    if (m) base = `#/${m[1]}`
    else base = `#/e/${encodeURIComponent(uri)}`
  } else {
    base = `#/e/${encodeURIComponent(uri)}`
  }
  if (overviewSection && overviewSection !== 'summary') {
    if (overviewSection.startsWith('w/')) {
      return `${base}/w/${overviewSection.slice(2)}`
    }
    return `${base}/${overviewSection}`
  }
  return base
}

export function hashForMapSnapshot(snapshotId: string): string {
  return `#/map/${snapshotId}`
}

export type HashParseResult =
  | { type: 'entity'; uri: string; overviewSection?: string }
  | { type: 'map'; snapshotId: string }
  | null

export function overviewSectionFromHash(hash: string): string | undefined {
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw || raw.startsWith('map/')) return undefined
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] === 'e') {
    if (parts.length >= 4 && parts[2] === 'w') return `w/${parts.slice(3).join('/')}`
    return parts.length >= 3 ? parts[2] : undefined
  }
  if (/^Q\d+$/i.test(parts[0] ?? '')) {
    if (parts[1] === 'w' && parts.length >= 3) return `w/${parts.slice(2).join('/')}`
    return parts[1]
  }
  return undefined
}


export function parseHash(hash: string, source: SparqlSourceId): HashParseResult {
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw) return null

  if (raw.startsWith('map/')) {
    const id = raw.slice(4).trim()
    return id ? { type: 'map', snapshotId: id } : null
  }

  const uri = entityFromHash(`#/${raw}`, source)
  const overviewSection = overviewSectionFromHash(hash)
  return uri ? { type: 'entity', uri, overviewSection } : null
}

export function entityFromHash(
  hash: string,
  source: SparqlSourceId,
): string | null {
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw || raw.startsWith('map/')) return null

  const parts = raw.split('/').filter(Boolean)

  if (parts[0] === 'e') {
    try {
      return decodeURIComponent(parts[1] ?? '')
    } catch {
      return null
    }
  }

  const qid = parts[0]?.match(/^(Q\d+)$/i)
  if (qid) {
    if (source === 'wikidata') {
      return `http://www.wikidata.org/entity/${qid[1].toUpperCase()}`
    }
    return null
  }

  return null
}
