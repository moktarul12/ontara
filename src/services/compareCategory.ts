import { isWikidataEndpoint, runSparql } from '../services/sparql-core'
import { entityKey } from '../utils/entityUrl'

const WDT = 'http://www.wikidata.org/prop/direct/'
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'

const Q5 = 'http://www.wikidata.org/entity/Q5'
const Q43229 = 'http://www.wikidata.org/entity/Q43229'
const Q11424 = 'http://www.wikidata.org/entity/Q11424'
const Q515 = 'http://www.wikidata.org/entity/Q515'

/** Too generic to drive peer suggestions. */
const GENERIC_INSTANCES = new Set([
  Q5,
  'http://www.wikidata.org/entity/Q35127', // entity
  'http://www.wikidata.org/entity/Q488383',
])

export type CompareCategoryKind = 'person' | 'org' | 'work' | 'place' | 'entity'

export type CompareCategory = {
  kind: CompareCategoryKind
  label: string
  searchClassUri?: string
  matchProp: 'occupation' | 'industry' | 'instance'
  matchUri: string
  matchLabel: string
}

export type CompareCategoryPeer = {
  uri: string
  label: string
  reason: string
}

type Signal = { uri: string; label: string }

export type CompareCategorySignals = {
  occupations: Signal[]
  industries: Signal[]
  instances: Signal[]
}

function dedupeSignals(items: Signal[]): Signal[] {
  const seen = new Set<string>()
  const out: Signal[] = []
  for (const item of items) {
    const key = entityKey(item.uri)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function kindFromInstance(inst: Signal): CompareCategoryKind {
  const blob = `${inst.uri} ${inst.label}`.toLowerCase()
  if (/Q11424|film|movie|television series|album|creative work|song/.test(blob)) return 'work'
  if (/Q515|Q486972|city|town|village|country|place|location/.test(blob)) return 'place'
  if (/Q43229|Q4830453|Q783794|Q6881511|company|organisation|organization|business|retailer|corporation/.test(blob)) {
    return 'org'
  }
  if (/Q5|human|person/.test(blob)) return 'person'
  return 'entity'
}

function searchClassForKind(kind: CompareCategoryKind): string | undefined {
  if (kind === 'person') return Q5
  if (kind === 'org') return Q43229
  if (kind === 'work') return Q11424
  if (kind === 'place') return Q515
  return undefined
}

/** Pick the best compare category from Wikidata signals (pure / testable). */
export function categoryFromSignals(signals: CompareCategorySignals): CompareCategory | null {
  const occupations = dedupeSignals(signals.occupations)
  const industries = dedupeSignals(signals.industries)
  const instances = dedupeSignals(signals.instances).filter((i) => !GENERIC_INSTANCES.has(i.uri))

  if (occupations.length) {
    const occ = occupations[0]
    return {
      kind: 'person',
      label: occ.label,
      searchClassUri: Q5,
      matchProp: 'occupation',
      matchUri: occ.uri,
      matchLabel: occ.label,
    }
  }

  if (industries.length) {
    const ind = industries[0]
    return {
      kind: 'org',
      label: `${ind.label} companies`,
      searchClassUri: Q43229,
      matchProp: 'industry',
      matchUri: ind.uri,
      matchLabel: ind.label,
    }
  }

  if (instances.length) {
    const inst = instances[0]
    const kind = kindFromInstance(inst)
    return {
      kind,
      label: inst.label,
      searchClassUri: searchClassForKind(kind),
      matchProp: 'instance',
      matchUri: inst.uri,
      matchLabel: inst.label,
    }
  }

  return null
}

async function loadSignals(endpoint: string, uri: string): Promise<CompareCategorySignals> {
  const query = `
    SELECT ?occupation ?occLabel ?industry ?indLabel ?inst ?instLabel WHERE {
      OPTIONAL {
        <${uri}> <${WDT}P106> ?occupation .
        ?occupation <${RDFS_LABEL}> ?occLabel .
        FILTER(LANG(?occLabel) = "en")
      }
      OPTIONAL {
        <${uri}> <${WDT}P452> ?industry .
        ?industry <${RDFS_LABEL}> ?indLabel .
        FILTER(LANG(?indLabel) = "en")
      }
      OPTIONAL {
        <${uri}> <${WDT}P31> ?inst .
        ?inst <${RDFS_LABEL}> ?instLabel .
        FILTER(LANG(?instLabel) = "en")
      }
    } LIMIT 40
  `
  const rows = await runSparql(endpoint, query, 12000)
  const occupations: Signal[] = []
  const industries: Signal[] = []
  const instances: Signal[] = []

  for (const r of rows) {
    if (r.occupation?.value && r.occLabel?.value) {
      occupations.push({ uri: r.occupation.value, label: r.occLabel.value })
    }
    if (r.industry?.value && r.indLabel?.value) {
      industries.push({ uri: r.industry.value, label: r.indLabel.value })
    }
    if (r.inst?.value && r.instLabel?.value && !GENERIC_INSTANCES.has(r.inst.value)) {
      instances.push({ uri: r.inst.value, label: r.instLabel.value })
    }
  }

  return { occupations, industries, instances }
}

function peerMatchClause(category: CompareCategory): { predicate: string; object: string } {
  if (category.matchProp === 'occupation') return { predicate: `${WDT}P106`, object: category.matchUri }
  if (category.matchProp === 'industry') return { predicate: `${WDT}P452`, object: category.matchUri }
  return { predicate: `${WDT}P31`, object: category.matchUri }
}

function reasonForPeer(category: CompareCategory): string {
  if (category.matchProp === 'occupation') return category.matchLabel
  if (category.matchProp === 'industry') return category.matchLabel
  return category.label
}

/** Resolve Wikidata category for the anchor entity. */
export async function resolveCompareCategory(
  endpoint: string,
  uri: string,
): Promise<CompareCategory | null> {
  if (!isWikidataEndpoint(endpoint)) return null
  try {
    const signals = await loadSignals(endpoint, uri)
    return categoryFromSignals(signals)
  } catch {
    return null
  }
}

/** Fetch Wikidata entities in the same category as the anchor. */
export async function fetchCompareCategoryPeers(
  endpoint: string,
  anchorUri: string,
  category: CompareCategory,
  excludeUris: string[] = [],
  limit = 10,
): Promise<CompareCategoryPeer[]> {
  if (!isWikidataEndpoint(endpoint)) return []

  const exclude = new Set(excludeUris.map(entityKey))
  exclude.add(entityKey(anchorUri))

  const { predicate, object } = peerMatchClause(category)
  const humanFilter =
    category.kind === 'person'
      ? `?item <${WDT}P31>/<${WDT}P279>* <${Q5}> .`
      : ''

  const query = `
    SELECT DISTINCT ?item ?label WHERE {
      ?item <${predicate}> <${object}> .
      ${humanFilter}
      ?item <${RDFS_LABEL}> ?label .
      FILTER(LANG(?label) = "en")
      FILTER(?item != <${anchorUri}>)
    } LIMIT ${Math.min(limit * 3, 36)}
  `

  try {
    const rows = await runSparql(endpoint, query, 12000)
    const reason = reasonForPeer(category)
    const out: CompareCategoryPeer[] = []
    for (const r of rows) {
      const peerUri = r.item.value
      if (exclude.has(entityKey(peerUri))) continue
      out.push({
        uri: peerUri,
        label: r.label?.value || peerUri.split('/').pop() || peerUri,
        reason,
      })
      if (out.length >= limit) break
    }
    return out
  } catch {
    return []
  }
}

export async function loadCompareCategoryBundle(
  endpoint: string,
  anchorUri: string,
  excludeUris: string[] = [],
): Promise<{ category: CompareCategory | null; peers: CompareCategoryPeer[] }> {
  const category = await resolveCompareCategory(endpoint, anchorUri)
  if (!category) return { category: null, peers: [] }
  const peers = await fetchCompareCategoryPeers(endpoint, anchorUri, category, excludeUris, 10)
  return { category, peers }
}