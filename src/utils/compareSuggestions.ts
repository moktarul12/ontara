import type { CompareCategory } from '../services/compareCategory'
import type { ConnectedNode, GraphLink, GraphNode } from '../types/ontology'
import { kindOf } from './nodeKind'

export type CompareSuggestion = {
  uri: string
  label: string
  reason?: string
}

/** Curated fallback when Wikidata peer query returns nothing (Bollywood). */
export const BOLLYWOOD_PEERS: CompareSuggestion[] = [
  { uri: 'http://www.wikidata.org/entity/Q8096', label: 'Shah Rukh Khan', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q9557', label: 'Aamir Khan', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q9545', label: 'Salman Khan', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q194356', label: 'Amitabh Bachchan', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q229576', label: 'Kajol', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q152613', label: 'Deepika Padukone', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q158745', label: 'Priyanka Chopra', reason: 'film actor' },
  { uri: 'http://www.wikidata.org/entity/Q135621', label: 'Hrithik Roshan', reason: 'film actor' },
]

const BOLLYWOOD_HINTS = [
  'bollywood',
  'hindi cinema',
  'hindi film',
  'khan',
  'kapoor',
  'bachchan',
]

const PERSON_CLASS = 'http://www.wikidata.org/entity/Q5'

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** True when labels suggest Bollywood (fallback only). */
export function isBollywoodContext(query: string, pinnedLabels: string[]): boolean {
  const blob = [query, ...pinnedLabels].join(' ').toLowerCase()
  if (BOLLYWOOD_HINTS.some((h) => blob.includes(h))) return true
  return BOLLYWOOD_PEERS.some((p) => blob.includes(norm(p.label)))
}

/** Scoped Wikidata class for compare search once anchor category is known. */
export function compareSearchClassUri(
  query: string,
  pinnedLabels: string[],
  category?: CompareCategory | null,
): string | undefined {
  if (category?.searchClassUri) return category.searchClassUri
  if (isBollywoodContext(query, pinnedLabels)) return PERSON_CLASS
  const q = query.trim()
  if (q.split(/\s+/).length >= 2) return PERSON_CLASS
  return undefined
}

function neighborIds(links: GraphLink[], id: string): Set<string> {
  const out = new Set<string>()
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id
    const t = typeof l.target === 'string' ? l.target : l.target.id
    if (s === id && !t.startsWith('relhub:') && !t.startsWith('literal:')) out.add(t)
    if (t === id && !s.startsWith('relhub:') && !s.startsWith('literal:')) out.add(s)
  }
  return out
}

function graphNeighborSuggestions(
  pinnedUris: Set<string>,
  nodes: GraphNode[],
  links: GraphLink[],
  categoryKind?: CompareCategory['kind'],
): CompareSuggestion[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const out: CompareSuggestion[] = []
  const seen = new Set<string>()

  for (const uri of pinnedUris) {
    if (!byId.has(uri)) continue
    for (const nid of neighborIds(links, uri)) {
      if (pinnedUris.has(nid) || seen.has(nid)) continue
      const n = byId.get(nid)
      if (!n) continue
      if (categoryKind && categoryKind !== 'entity' && kindOf(n) !== categoryKind) continue
      seen.add(nid)
      out.push({ uri: n.uri, label: n.label, reason: 'On your map' })
    }
  }
  return out
}

function bollywoodFallback(pinnedUris: Set<string>): CompareSuggestion[] {
  return BOLLYWOOD_PEERS.filter((p) => !pinnedUris.has(p.uri)).slice(0, 8)
}

/**
 * Merge search hits, Wikidata same-category peers, map neighbors, and optional Bollywood fallback.
 */
export function buildCompareSuggestions(options: {
  query: string
  pinnedUris: Set<string>
  pinnedLabels: string[]
  graphNodes: GraphNode[]
  graphLinks: GraphLink[]
  searchHits: ConnectedNode[]
  categoryPeers?: CompareSuggestion[]
  category?: CompareCategory | null
}): CompareSuggestion[] {
  const {
    query,
    pinnedUris,
    pinnedLabels,
    graphNodes,
    graphLinks,
    searchHits,
    categoryPeers = [],
    category,
  } = options
  const out: CompareSuggestion[] = []
  const seen = new Set<string>()

  const push = (s: CompareSuggestion) => {
    if (pinnedUris.has(s.uri) || seen.has(s.uri)) return
    seen.add(s.uri)
    out.push(s)
  }

  for (const hit of searchHits) {
    push({ uri: hit.uri, label: hit.label, reason: hit.typeLabel ?? 'Search result' })
  }

  for (const s of categoryPeers) push(s)

  for (const s of graphNeighborSuggestions(pinnedUris, graphNodes, graphLinks, category?.kind)) {
    push(s)
  }

  if (!categoryPeers.length && isBollywoodContext(query, pinnedLabels)) {
    for (const s of bollywoodFallback(pinnedUris)) push(s)
  }

  return out.slice(0, 12)
}

/** Chip-style suggestions (excludes full search-result list duplicates). */
export function compareSuggestionChips(
  all: CompareSuggestion[],
  searchHits: ConnectedNode[],
): CompareSuggestion[] {
  const hitUris = new Set(searchHits.map((h) => h.uri))
  return all.filter((s) => s.reason !== 'Search result' || !hitUris.has(s.uri)).slice(0, 8)
}

/** Idle chips when search box is empty — category peers first, then Bollywood fallback. */
export function idleCompareChips(options: {
  pinnedUris: Set<string>
  pinnedLabels: string[]
  categoryPeers: CompareSuggestion[]
}): CompareSuggestion[] {
  const { pinnedUris, pinnedLabels, categoryPeers } = options
  const filtered = categoryPeers.filter((p) => !pinnedUris.has(p.uri))
  if (filtered.length) return filtered.slice(0, 8)
  if (isBollywoodContext('', pinnedLabels)) return bollywoodFallback(pinnedUris)
  return []
}
