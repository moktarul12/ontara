import {
  SPARQL_SOURCES,
  WIKIDATA_ENDPOINT,
  type DataProperty,
  type SparqlSourceId,
} from '../types/ontology'
import type { FacetPredicate } from '../types/facets'
import { flattenFacetPredicates, ORG_FACETS, PERSON_FACETS, WORK_FACETS } from '../types/facets'
import { pickLongSummary } from '../utils/profileNarrative'
import { fetchWikidataClaimFacts } from './wikidataClaims'
import { fetchEntityLanguageVariants, pickLanguageVariant } from './entityLanguages'
import { fetchDataProperties, fetchResourceClasses } from './sparql'
import { isWikidataEndpoint, runSparql } from './sparql-core'
import * as wd from './wikidata'

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs'
const DBO_ABSTRACT = 'http://dbpedia.org/ontology/abstract'
const WDT = 'http://www.wikidata.org/prop/direct/'

export type ProfileFactGroup =
  | 'identity'
  | 'life'
  | 'career'
  | 'family'
  | 'awards'
  | 'links'
  | 'other'

export type ProfileFact = {
  predicate: string
  predicateLabel: string
  value: string
  valueUri?: string
  source: SparqlSourceId
  group: ProfileFactGroup
  lang?: string
}

export type EntityProfile = {
  uri: string
  label: string
  description?: string
  /** Long-form summary — prefers DBpedia abstract, falls back to Wikidata description. */
  longSummary?: string
  abstractSource?: SparqlSourceId
  imageUrl?: string
  kind: 'person' | 'org' | 'work' | 'place' | 'other'
  classes: string[]
  facts: ProfileFact[]
  factsByGroup: Record<ProfileFactGroup, ProfileFact[]>
  sourcesUsed: SparqlSourceId[]
  sourceUris: Partial<Record<SparqlSourceId, string>>
}

const EXTRA_PERSON_PREDICATES: FacetPredicate[] = [
  { predicate: `${WDT}P569`, direction: 'out', label: 'date of birth' },
  { predicate: `${WDT}P570`, direction: 'out', label: 'date of death' },
  { predicate: `${WDT}P856`, direction: 'out', label: 'official website' },
  { predicate: `${WDT}P1477`, direction: 'out', label: 'birth name' },
  { predicate: `${WDT}P734`, direction: 'out', label: 'family name' },
  { predicate: `${WDT}P735`, direction: 'out', label: 'given name' },
]

const GROUP_BY_LABEL: Record<string, ProfileFactGroup> = {
  'instance of': 'identity',
  'country of citizenship': 'identity',
  'place of birth': 'life',
  'place of death': 'life',
  'languages spoken': 'identity',
  'native language': 'identity',
  'sex or gender': 'identity',
  'date of birth': 'life',
  'date of death': 'life',
  father: 'family',
  mother: 'family',
  spouse: 'family',
  child: 'family',
  sibling: 'family',
  relative: 'family',
  'unmarried partner': 'family',
  occupation: 'career',
  employer: 'career',
  'educated at': 'career',
  'field of work': 'career',
  genre: 'career',
  'notable work': 'career',
  'work location': 'career',
  'member of': 'career',
  'cast in': 'career',
  directed: 'career',
  'screenplay by': 'career',
  'award received': 'awards',
  'nominated for': 'awards',
  'political party': 'career',
  'position held': 'career',
  'candidacy in election': 'career',
  'elected in': 'career',
  'owner of': 'career',
  founded: 'career',
  owns: 'career',
  'board member of': 'career',
  'founded by': 'career',
  'birth name': 'identity',
  'family name': 'identity',
  'given name': 'identity',
  'official website': 'links',
  abstract: 'identity',
  description: 'identity',
  director: 'career',
  'cast member': 'career',
  screenwriter: 'career',
  producer: 'career',
  'production company': 'career',
  composer: 'career',
  'publication date': 'life',
  'release date': 'life',
  'country of origin': 'identity',
  'original language': 'identity',
  'filming location': 'life',
  'narrative location': 'life',
  'distributed by': 'links',
  industry: 'career',
  inception: 'life',
  'company milestone': 'life',
  'significant event': 'life',
  headquarters: 'identity',
  'headquarters location': 'identity',
  'chief executive officer': 'career',
  employees: 'identity',
  revenue: 'identity',
  'voice actor': 'career',
  performer: 'career',
  'record label': 'career',
  'based on': 'career',
  'part of series': 'career',
  'original broadcaster': 'career',
  'executive producer': 'career',
  'director of photography': 'career',
  'film editor': 'career',
  'music featured': 'career',
  'main subject': 'career',
}

function groupForLabel(label: string): ProfileFactGroup {
  const key = label.trim().toLowerCase()
  return GROUP_BY_LABEL[key] ?? 'other'
}

function factKey(f: Pick<ProfileFact, 'predicateLabel' | 'value'>): string {
  return `${f.predicateLabel.toLowerCase()}|${f.value.trim().toLowerCase()}`
}

export function mergeProfileFacts(facts: ProfileFact[]): ProfileFact[] {
  const byKey = new Map<string, ProfileFact>()
  const priority: SparqlSourceId[] = ['wikidata', 'dbpedia', 'yago']
  const sorted = [...facts].sort(
    (a, b) => priority.indexOf(a.source) - priority.indexOf(b.source),
  )
  for (const f of sorted) {
    const key = factKey(f)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, f)
      continue
    }
    if (!prev.valueUri && f.valueUri) byKey.set(key, f)
  }
  return [...byKey.values()]
}

export function groupProfileFacts(facts: ProfileFact[]): Record<ProfileFactGroup, ProfileFact[]> {
  const groups: Record<ProfileFactGroup, ProfileFact[]> = {
    identity: [],
    life: [],
    career: [],
    family: [],
    awards: [],
    links: [],
    other: [],
  }
  for (const f of facts) {
    groups[f.group].push(f)
  }
  return groups
}

function toProfileFacts(props: DataProperty[], source: SparqlSourceId): ProfileFact[] {
  return props.map((p) => {
    const predicateLabel = p.predicateLabel || p.predicate.split('/').pop() || 'Fact'
    return {
      predicate: p.predicate,
      predicateLabel,
      value: p.value,
      source,
      group: groupForLabel(predicateLabel),
      lang: p.lang,
    }
  })
}

function wikidataUriFromAny(uri: string): string | null {
  const m = uri.match(/wikidata\.org\/entity\/(Q\d+)/i)
  return m ? `http://www.wikidata.org/entity/${m[1].toUpperCase()}` : null
}

/** Resolve equivalent URIs across Wikidata, DBpedia, YAGO. */
export async function resolveCrossSourceUris(
  seedUri: string,
): Promise<Partial<Record<SparqlSourceId, string>>> {
  const out: Partial<Record<SparqlSourceId, string>> = {}
  const wdUri = wikidataUriFromAny(seedUri)
  if (wdUri) out.wikidata = wdUri
  if (seedUri.includes('dbpedia.org')) out.dbpedia = seedUri
  if (seedUri.includes('yago-knowledge.org') || seedUri.includes('/yago/')) out.yago = seedUri

  const lookupUri = wdUri ?? seedUri

  const query = `
    SELECT ?same WHERE {
      {
        <${lookupUri}> <${OWL_SAME_AS}> ?same .
      } UNION {
        ?same <${OWL_SAME_AS}> <${lookupUri}> .
      }
    } LIMIT 24
  `

  try {
    const rows = await runSparql(WIKIDATA_ENDPOINT, query, 10000)
    for (const r of rows) {
      const u = r.same?.value
      if (!u) continue
      if (u.includes('dbpedia.org/resource/') && !out.dbpedia) out.dbpedia = u
      if ((u.includes('yago-knowledge.org') || u.includes('yago')) && !out.yago) out.yago = u
      const linkedWd = wikidataUriFromAny(u)
      if (linkedWd && !out.wikidata) out.wikidata = linkedWd
    }
  } catch {
    /* optional cross-links */
  }

  if (!out.wikidata && wdUri) out.wikidata = wdUri
  if (!out.dbpedia && seedUri.includes('dbpedia.org')) out.dbpedia = seedUri
  return out
}

async function fetchWikidataFacetFacts(
  uri: string,
  lang: string,
  facets: typeof PERSON_FACETS,
): Promise<ProfileFact[]> {
  const predicates = flattenFacetPredicates(facets)
  if (!predicates.length) return []

  const values = predicates.map(
    (p) =>
      `( <${p.predicate}> "${(p.label || 'fact').replace(/"/g, '\\"')}" "${p.direction}" )`,
  ).join(' ')

  const query = `
    SELECT ?prop ?propLabel ?value ?valueLabel WHERE {
      VALUES (?prop ?propLabel ?dir) { ${values} }
      BIND(<${uri}> AS ?item)
      {
        ?item ?prop ?value .
        FILTER(?dir = "out")
      } UNION {
        ?value ?prop ?item .
        FILTER(?dir = "in")
      }
      OPTIONAL {
        ?value <${RDFS_LABEL}> ?valueLabel .
        FILTER(LANG(?valueLabel) = "${lang}" || LANG(?valueLabel) = "en" || LANG(?valueLabel) = "")
      }
    }
  `

  try {
    const rows = await runSparql(WIKIDATA_ENDPOINT, query, 16000)
    const out: ProfileFact[] = []
    const seen = new Set<string>()
    for (const r of rows) {
      const predicateLabel = r.propLabel?.value || r.prop?.value?.split('/').pop() || 'Fact'
      const value = r.valueLabel?.value || r.value?.value || ''
      if (!value.trim() || /^Q\d+$/i.test(value)) continue
      const key = `${predicateLabel}|${value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        predicate: r.prop.value,
        predicateLabel,
        value: value.trim(),
        source: 'wikidata',
        group: groupForLabel(predicateLabel),
      })
    }
    return out
  } catch {
    return []
  }
}

async function fetchWikidataPersonFacts(uri: string, lang: string): Promise<ProfileFact[]> {
  return fetchWikidataFacetFacts(uri, lang, [
    ...PERSON_FACETS,
    {
      id: 'identity',
      label: 'Identity extras',
      hint: 'Dates and names',
      for: 'person',
      predicates: EXTRA_PERSON_PREDICATES,
    },
  ])
}

export async function fetchKindFacetFacts(
  uri: string,
  kind: EntityProfile['kind'],
  lang: string,
): Promise<ProfileFact[]> {
  if (kind === 'person') return fetchWikidataPersonFacts(uri, lang)
  if (kind === 'work') return fetchWikidataFacetFacts(uri, lang, WORK_FACETS)
  if (kind === 'org') return fetchWikidataFacetFacts(uri, lang, ORG_FACETS)
  return []
}

/** Lightweight DBpedia abstract for overview enrich (optional). */
export async function fetchDbpediaAbstractQuick(uri: string, lang: string): Promise<string | undefined> {
  return fetchDbpediaAbstract(uri, lang)
}

async function fetchDbpediaAbstract(uri: string, lang: string): Promise<string | undefined> {
  const endpoint = SPARQL_SOURCES.find((s) => s.id === 'dbpedia')?.endpoint
  if (!endpoint) return undefined

  let dbpUri = uri.includes('dbpedia.org') ? uri : null
  if (!dbpUri && uri.includes('wikidata.org')) {
    const qid = uri.match(/(Q\d+)/i)?.[1]
    if (qid) {
      try {
        const rows = await runSparql(
          endpoint,
          `SELECT ?dbp WHERE { <http://www.wikidata.org/entity/${qid.toUpperCase()}> <${OWL_SAME_AS}> ?dbp . FILTER(CONTAINS(STR(?dbp), "dbpedia.org/resource")) } LIMIT 1`,
          10000,
        )
        dbpUri = rows[0]?.dbp?.value ?? null
      } catch {
        /* optional */
      }
    }
  }
  if (!dbpUri) return undefined

  const langs = lang === 'en' ? ['en'] : [lang, 'en']
  for (const code of langs) {
    const query = `
      SELECT ?abstract WHERE {
        <${dbpUri}> <${DBO_ABSTRACT}> ?abstract .
        FILTER(LANG(?abstract) = "${code}")
      } LIMIT 1
    `
    try {
      const rows = await runSparql(endpoint, query, 12000)
      const text = rows[0]?.abstract?.value?.trim()
      if (text) return text
    } catch {
      /* try next language */
    }
  }
  return undefined
}

async function fetchFromSource(source: SparqlSourceId, uri: string): Promise<ProfileFact[]> {
  const endpoint = SPARQL_SOURCES.find((s) => s.id === source)?.endpoint
  if (!endpoint || !uri) return []
  try {
    const props = await fetchDataProperties(endpoint, uri)
    return toProfileFacts(props, source)
  } catch {
    return []
  }
}

export const PROFILE_GROUP_TITLES: Record<ProfileFactGroup, string> = {
  identity: 'Identity',
  life: 'Life',
  career: 'Career & work',
  family: 'Family',
  awards: 'Awards & recognition',
  links: 'Links',
  other: 'More facts',
}

/** Load a dossier from Wikidata + DBpedia + YAGO when linked. */
export async function fetchEntityProfile(
  seedUri: string,
  primarySource: SparqlSourceId,
  lang = 'en',
): Promise<EntityProfile> {
  const sourceUris = await resolveCrossSourceUris(seedUri)
  if (!sourceUris.wikidata && wikidataUriFromAny(seedUri)) {
    sourceUris.wikidata = wikidataUriFromAny(seedUri)!
  }
  if (!sourceUris[primarySource]) sourceUris[primarySource] = seedUri

  const wdUri = sourceUris.wikidata ?? (primarySource === 'wikidata' ? seedUri : null)
  const kind =
    wdUri && isWikidataEndpoint(WIKIDATA_ENDPOINT)
      ? await wd.wdEntityKind(WIKIDATA_ENDPOINT, wdUri)
      : 'other'

  const tasks: Promise<ProfileFact[]>[] = []

  if (wdUri && kind === 'person') {
    tasks.push(fetchWikidataPersonFacts(wdUri, lang))
  } else if (wdUri && kind === 'work') {
    tasks.push(fetchWikidataFacetFacts(wdUri, lang, WORK_FACETS))
  } else if (wdUri && kind === 'org') {
    tasks.push(fetchWikidataFacetFacts(wdUri, lang, ORG_FACETS))
  } else if (wdUri) {
    tasks.push(fetchFromSource('wikidata', wdUri))
  }

  if (sourceUris.dbpedia && sourceUris.dbpedia !== wdUri) {
    tasks.push(fetchFromSource('dbpedia', sourceUris.dbpedia))
  }
  if (sourceUris.yago && sourceUris.yago !== wdUri) {
    tasks.push(fetchFromSource('yago', sourceUris.yago))
  }

  if (!wdUri && primarySource !== 'wikidata') {
    tasks.push(fetchFromSource(primarySource, seedUri))
  }

  const dbpediaUri = sourceUris.dbpedia ?? wdUri

  const [factsNested, langVariants, classes, imageUrl, dbpediaAbstract, claimPack] =
    await Promise.all([
      Promise.all(tasks),
      wdUri ? fetchEntityLanguageVariants(WIKIDATA_ENDPOINT, wdUri) : Promise.resolve([]),
      wdUri
        ? fetchResourceClasses(WIKIDATA_ENDPOINT, wdUri)
        : fetchResourceClasses(
            SPARQL_SOURCES.find((s) => s.id === primarySource)?.endpoint ?? WIKIDATA_ENDPOINT,
            seedUri,
          ).catch(() => []),
      wdUri ? wd.wdEntityImage(WIKIDATA_ENDPOINT, wdUri, 480) : Promise.resolve(null),
      wdUri ? fetchDbpediaAbstract(dbpediaUri ?? wdUri, lang) : Promise.resolve(undefined),
      wdUri ? fetchWikidataClaimFacts(wdUri, lang) : Promise.resolve({ facts: [], description: undefined, label: undefined }),
    ])

  const sparqlFacts = factsNested.flat()
  const merged = mergeProfileFacts([...sparqlFacts, ...claimPack.facts])
  const active = pickLanguageVariant(langVariants, lang)
  const sourcesUsed = [...new Set(merged.map((f) => f.source))] as SparqlSourceId[]
  if (dbpediaAbstract && !sourcesUsed.includes('dbpedia')) sourcesUsed.push('dbpedia')

  const description =
    active?.description ?? claimPack.description ?? undefined
  const longSummary = pickLongSummary(description, dbpediaAbstract)
  const abstractSource: SparqlSourceId | undefined = dbpediaAbstract
    ? 'dbpedia'
    : description
      ? 'wikidata'
      : undefined

  return {
    uri: wdUri ?? seedUri,
    label: active?.label ?? claimPack.label ?? seedUri.split('/').pop() ?? 'Entity',
    description,
    longSummary,
    abstractSource,
    imageUrl: imageUrl ?? undefined,
    kind: kind === 'other' ? 'other' : kind,
    classes,
    facts: merged,
    factsByGroup: groupProfileFacts(merged),
    sourcesUsed,
    sourceUris,
  }
}
