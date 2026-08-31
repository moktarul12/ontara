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

/** Shareable hash: `#/Q42/`, `#/Q42/knowledge-graph`, `#/Q42/w/history`, `#/map/<id>`. */
export type EntityRouteView = 'overview' | 'graph'

export function hashParts(hash: string): string[] {
  return hash.replace(/^#/, '').replace(/^\//, '').trim().split('/').filter(Boolean)
}

function entityHashBase(uri: string, source: SparqlSourceId): string {
  if (source === 'wikidata') {
    const m = uri.match(/\/entity\/(Q\d+)$/i)
    if (m) return `#/${m[1]}`
  }
  return `#/e/${encodeURIComponent(uri)}`
}

export function hashForEntityTab(
  uri: string,
  source: SparqlSourceId,
  view: EntityRouteView,
  overviewSection?: string,
): string {
  const base = entityHashBase(uri, source)

  if (view === 'graph') return `${base}/knowledge-graph`

  if (overviewSection && overviewSection !== 'summary') {
    if (overviewSection.startsWith('w/')) {
      return `${base}/w/${overviewSection.slice(2)}`
    }
    return `${base}/${overviewSection}`
  }

  return `${base}/overview`
}

export function hashForEntity(
  uri: string,
  source: SparqlSourceId,
  overviewSection?: string,
): string {
  if (!overviewSection || overviewSection === 'summary') {
    return hashForEntityTab(uri, source, 'overview')
  }
  return hashForEntityTab(uri, source, 'overview', overviewSection)
}

export function hashForMapSnapshot(snapshotId: string): string {
  return `#/map/${snapshotId}`
}

export type HashParseResult =
  | { type: 'entity'; uri: string; overviewSection?: string; entityView?: EntityRouteView }
  | { type: 'map'; snapshotId: string }
  | null

export function parseEntityRoute(
  hash: string,
  source: SparqlSourceId,
): { uri: string; overviewSection?: string; entityView?: EntityRouteView } | null {
  const parts = hashParts(hash)
  if (!parts.length || parts[0] === 'map') return null

  let uri: string | null = null
  let i = 0

  if (parts[0] === 'e') {
    if (!parts[1]) return null
    try {
      uri = decodeURIComponent(parts[1])
    } catch {
      return null
    }
    i = 2
  } else if (/^Q\d+$/i.test(parts[0] ?? '')) {
    if (source !== 'wikidata') return null
    uri = `http://www.wikidata.org/entity/${parts[0]!.toUpperCase()}`
    i = 1
  } else {
    return null
  }

  const rest = parts.slice(i)
  if (!rest.length) {
    return { uri, entityView: 'overview', overviewSection: 'summary' }
  }

  if (rest[0] === 'overview') {
    if (rest[1] === 'w' && rest.length >= 3) {
      return { uri, entityView: 'overview', overviewSection: `w/${rest.slice(2).join('/')}` }
    }
    if (rest[1]) return { uri, entityView: 'overview', overviewSection: rest[1] }
    return { uri, entityView: 'overview', overviewSection: 'summary' }
  }

  if (rest[0] === 'knowledge-graph' || rest[0] === 'graph') {
    return { uri, entityView: 'graph' }
  }

  if (rest[0] === 'w' && rest.length >= 2) {
    return { uri, entityView: 'overview', overviewSection: `w/${rest.slice(1).join('/')}` }
  }

  return { uri, entityView: 'overview', overviewSection: rest[0] }
}

export function overviewSectionFromHash(hash: string): string | undefined {
  const route = parseEntityRoute(hash, 'wikidata')
  if (route?.overviewSection && route.overviewSection !== 'summary') {
    return route.overviewSection
  }
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw || raw.startsWith('map/')) return undefined
  const parts = raw.split('/').filter(Boolean)
  if (parts[0] === 'e') {
    if (parts.length >= 4 && parts[2] === 'w') return `w/${parts.slice(3).join('/')}`
    return parts.length >= 3 ? parts[2] : undefined
  }
  if (/^Q\d+$/i.test(parts[0] ?? '')) {
    if (parts[1] === 'w' && parts.length >= 3) return `w/${parts.slice(2).join('/')}`
    if (!parts[1] || parts[1] === 'overview') return undefined
    if (parts[1] === 'knowledge-graph' || parts[1] === 'graph') return undefined
    return parts[1]
  }
  return undefined
}

export function entityViewFromHash(hash: string, source: SparqlSourceId): EntityRouteView | undefined {
  return parseEntityRoute(hash, source)?.entityView
}

export function parseHash(hash: string, source: SparqlSourceId): HashParseResult {
  const raw = hash.replace(/^#/, '').replace(/^\//, '').trim()
  if (!raw) return null

  if (raw.startsWith('map/')) {
    const id = raw.slice(4).trim()
    return id ? { type: 'map', snapshotId: id } : null
  }

  const uri = entityFromHash(`#/${raw}`, source)
  const route = parseEntityRoute(hash, source)
  return uri
    ? {
        type: 'entity',
        uri,
        overviewSection: route?.overviewSection,
        entityView: route?.entityView,
      }
    : null
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
