import {
  categoryFromSignals,
  type CompareCategoryKind,
  type CompareCategorySignals,
} from './compareCategory'
import { isWikidataEndpoint, runSparql } from './sparql-core'
import type { ConnectedNode, SearchCategoryChip, SearchCategoryFilter, SearchHitDetail } from '../types/ontology'
import { entityKey } from '../utils/entityUrl'

const WDT = 'http://www.wikidata.org/prop/direct/'
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const SCHEMA_DESC = 'http://schema.org/description'

const GENERIC_INST = new Set([
  'http://www.wikidata.org/entity/Q5',
  'http://www.wikidata.org/entity/Q35127',
])

const KIND_LABEL: Record<SearchHitDetail['kind'], string> = {
  person: 'People',
  org: 'Organizations',
  work: 'Films & works',
  place: 'Places',
  entity: 'Other',
}

function qidFromUri(uri: string): string | undefined {
  const m = uri.match(/\/entity\/(Q\d+)$/i)
  return m ? m[1].toUpperCase() : undefined
}

function kindFromCategoryKind(k: CompareCategoryKind): SearchHitDetail['kind'] {
  return k === 'entity' ? 'entity' : k
}

function hitFromSignals(
  hit: ConnectedNode,
  signals: CompareCategorySignals,
  extra: { description?: string; country?: string },
): SearchHitDetail {
  const cat = categoryFromSignals(signals)
  const kind = cat ? kindFromCategoryKind(cat.kind) : inferKindFromText(hit)
  const categoryLabel =
    cat?.label ||
    hit.typeLabel?.split(/[,.]/)[0]?.trim() ||
    KIND_LABEL[kind]

  const metaParts: string[] = []
  if (signals.industries[0]?.label && kind === 'org') metaParts.push(signals.industries[0].label)
  if (signals.occupations[1]?.label) metaParts.push(signals.occupations[1].label)
  if (extra.country) metaParts.push(extra.country)

  return {
    ...hit,
    kind,
    categoryLabel,
    description: extra.description || hit.typeLabel,
    meta: metaParts.slice(0, 2).join(' · ') || undefined,
    qid: qidFromUri(hit.uri),
  }
}

function inferKindFromText(hit: ConnectedNode): SearchHitDetail['kind'] {
  const blob = `${hit.typeLabel ?? ''} ${hit.label}`.toLowerCase()
  if (/human|person|actor|actress|director|politician|writer|singer|musician/.test(blob)) {
    return 'person'
  }
  if (/film|movie|series|album|song|book|work|television/.test(blob)) return 'work'
  if (/company|organisation|organization|corporation|retailer|business|brand/.test(blob)) {
    return 'org'
  }
  if (/city|country|place|village|town|location|capital/.test(blob)) return 'place'
  return 'entity'
}

function fallbackHit(hit: ConnectedNode): SearchHitDetail {
  const kind = inferKindFromText(hit)
  return {
    ...hit,
    kind,
    categoryLabel: hit.typeLabel?.split(/[,.]/)[0]?.trim() || KIND_LABEL[kind],
    description: hit.typeLabel,
    qid: qidFromUri(hit.uri),
  }
}

async function wikidataEnrichBatch(
  endpoint: string,
  hits: ConnectedNode[],
): Promise<Map<string, SearchHitDetail>> {
  const uris = hits.slice(0, 10).map((h) => h.uri)
  if (!uris.length) return new Map()

  const values = uris.map((u) => `<${u}>`).join(' ')
  const query = `
    SELECT ?item ?desc ?occ ?occLabel ?ind ?indLabel ?inst ?instLabel ?country ?countryLabel WHERE {
      VALUES ?item { ${values} }
      OPTIONAL {
        ?item <${SCHEMA_DESC}> ?desc .
        FILTER(LANG(?desc) = "en")
      }
      OPTIONAL {
        ?item <${WDT}P106> ?occ .
        ?occ <${RDFS_LABEL}> ?occLabel .
        FILTER(LANG(?occLabel) = "en")
      }
      OPTIONAL {
        ?item <${WDT}P452> ?ind .
        ?ind <${RDFS_LABEL}> ?indLabel .
        FILTER(LANG(?indLabel) = "en")
      }
      OPTIONAL {
        ?item <${WDT}P31> ?inst .
        ?inst <${RDFS_LABEL}> ?instLabel .
        FILTER(LANG(?instLabel) = "en")
      }
      OPTIONAL {
        ?item <${WDT}P27> ?country .
        ?country <${RDFS_LABEL}> ?countryLabel .
        FILTER(LANG(?countryLabel) = "en")
      }
    }
  `

  const rows = await runSparql(endpoint, query, 14000)
  const byUri = new Map<
    string,
    CompareCategorySignals & { description?: string; country?: string }
  >()

  for (const r of rows) {
    const uri = r.item?.value
    if (!uri) continue
    const bucket = byUri.get(uri) ?? {
      occupations: [],
      industries: [],
      instances: [],
    }
    if (r.occ?.value && r.occLabel?.value) {
      bucket.occupations.push({ uri: r.occ.value, label: r.occLabel.value })
    }
    if (r.ind?.value && r.indLabel?.value) {
      bucket.industries.push({ uri: r.ind.value, label: r.indLabel.value })
    }
    if (r.inst?.value && r.instLabel?.value && !GENERIC_INST.has(r.inst.value)) {
      bucket.instances.push({ uri: r.inst.value, label: r.instLabel.value })
    }
    if (r.desc?.value && !bucket.description) bucket.description = r.desc.value
    if (r.countryLabel?.value && !bucket.country) bucket.country = r.countryLabel.value
    byUri.set(uri, bucket)
  }

  const out = new Map<string, SearchHitDetail>()
  for (const hit of hits) {
    const sig = byUri.get(hit.uri)
    out.set(hit.uri, sig ? hitFromSignals(hit, sig, sig) : fallbackHit(hit))
  }
  return out
}

/** Enrich plain search hits with dynamic Wikidata categories and descriptions. */
export async function enrichSearchHits(
  endpoint: string,
  hits: ConnectedNode[],
): Promise<SearchHitDetail[]> {
  if (!hits.length) return []
  if (isWikidataEndpoint(endpoint)) {
    try {
      const enriched = await wikidataEnrichBatch(endpoint, hits)
      return hits.map((h) => enriched.get(h.uri) ?? fallbackHit(h))
    } catch {
      /* fall through */
    }
  }
  return hits.map(fallbackHit)
}

const QUERY_KIND_HINTS: { kind: SearchHitDetail['kind']; words: RegExp }[] = [
  { kind: 'person', words: /\b(actor|actress|director|person|people|politician|singer|writer|human|star)\b/i },
  { kind: 'work', words: /\b(film|movie|series|album|song|book|show|picture)\b/i },
  { kind: 'org', words: /\b(company|corp|store|brand|organisation|organization|retailer|bank|startup)\b/i },
  { kind: 'place', words: /\b(city|country|place|town|village|capital|state|region)\b/i },
]

/** Guess entity kind from query text for smart search hints. */
export function inferKindFromQuery(query: string): SearchHitDetail['kind'] | null {
  for (const { kind, words } of QUERY_KIND_HINTS) {
    if (words.test(query)) return kind
  }
  return null
}

export function buildSearchCategoryChips(hits: SearchHitDetail[]): SearchCategoryChip[] {
  if (!hits.length) return []

  const chips: SearchCategoryChip[] = [
    { id: 'all', label: `All (${hits.length})`, count: hits.length, filter: { type: 'all' } },
  ]

  const byKind = new Map<SearchHitDetail['kind'], number>()
  const byCategory = new Map<string, number>()

  for (const h of hits) {
    byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + 1)
    const key = h.categoryLabel.trim()
    if (key && key !== KIND_LABEL[h.kind]) {
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1)
    }
  }

  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    if (kind === 'entity' && count < 2) continue
    chips.push({
      id: `kind:${kind}`,
      label: `${KIND_LABEL[kind]} (${count})`,
      count,
      filter: { type: 'kind', kind },
    })
  }

  for (const [label, count] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
    if (count < 2) continue
    chips.push({
      id: `cat:${entityKey(label)}`,
      label: `${label} (${count})`,
      count,
      filter: { type: 'category', label },
    })
  }

  return chips.slice(0, 8)
}

export function filterSearchHits(
  hits: SearchHitDetail[],
  filter: SearchCategoryFilter,
): SearchHitDetail[] {
  if (filter.type === 'all') return hits
  if (filter.type === 'kind') return hits.filter((h) => h.kind === filter.kind)
  return hits.filter((h) => h.categoryLabel === filter.label)
}

export function searchResultSummary(hits: SearchHitDetail[]): string {
  if (!hits.length) return ''
  const parts: string[] = []
  const byKind = new Map<string, number>()
  for (const h of hits) {
    byKind.set(KIND_LABEL[h.kind], (byKind.get(KIND_LABEL[h.kind]) ?? 0) + 1)
  }
  for (const [label, n] of byKind.entries()) {
    parts.push(`${n} ${label.toLowerCase()}`)
  }
  return parts.join(' · ')
}

export { KIND_LABEL as SEARCH_KIND_LABEL }
