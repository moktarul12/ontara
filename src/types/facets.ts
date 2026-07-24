/**
 * Curated knowledge facets — Ontodia / enterprise KG style exploration recipes.
 * Used for Wikidata person dossiers and org leadership views.
 */

const WDT = 'http://www.wikidata.org/prop/direct/'

export type FacetId =
  | 'identity'
  | 'family'
  | 'career'
  | 'awards'
  | 'politics'
  | 'business'
  | 'leadership'
  | 'works'

export interface FacetPredicate {
  predicate: string
  direction: 'out' | 'in'
  /** Soft cap of values to pull when expanding this facet */
  limit?: number
  /** Human label for hub chip */
  label?: string
}

export interface KnowledgeFacet {
  id: FacetId
  label: string
  hint: string
  /** Who this facet is for */
  for: 'person' | 'org' | 'work' | 'any'
  predicates: FacetPredicate[]
}

export const PERSON_FACETS: KnowledgeFacet[] = [
  {
    id: 'identity',
    label: 'Identity',
    hint: 'Citizenship, birth place, languages',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P31`, direction: 'out', limit: 3, label: 'instance of' },
      { predicate: `${WDT}P27`, direction: 'out', limit: 4, label: 'country of citizenship' },
      { predicate: `${WDT}P19`, direction: 'out', limit: 2, label: 'place of birth' },
      { predicate: `${WDT}P20`, direction: 'out', limit: 2, label: 'place of death' },
      { predicate: `${WDT}P1412`, direction: 'out', limit: 4, label: 'languages spoken' },
      { predicate: `${WDT}P103`, direction: 'out', limit: 2, label: 'native language' },
      { predicate: `${WDT}P21`, direction: 'out', limit: 1, label: 'sex or gender' },
    ],
  },
  {
    id: 'family',
    label: 'Family',
    hint: 'Parents, spouse, children, relatives',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P22`, direction: 'out', limit: 2, label: 'father' },
      { predicate: `${WDT}P25`, direction: 'out', limit: 2, label: 'mother' },
      { predicate: `${WDT}P26`, direction: 'out', limit: 4, label: 'spouse' },
      { predicate: `${WDT}P40`, direction: 'out', limit: 8, label: 'child' },
      { predicate: `${WDT}P3373`, direction: 'out', limit: 8, label: 'sibling' },
      { predicate: `${WDT}P1038`, direction: 'out', limit: 6, label: 'relative' },
      { predicate: `${WDT}P451`, direction: 'out', limit: 3, label: 'unmarried partner' },
    ],
  },
  {
    id: 'career',
    label: 'Career',
    hint: 'Occupation, employer, education, notable work',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P106`, direction: 'out', limit: 8, label: 'occupation' },
      { predicate: `${WDT}P108`, direction: 'out', limit: 6, label: 'employer' },
      { predicate: `${WDT}P69`, direction: 'out', limit: 5, label: 'educated at' },
      { predicate: `${WDT}P101`, direction: 'out', limit: 4, label: 'field of work' },
      { predicate: `${WDT}P136`, direction: 'out', limit: 6, label: 'genre' },
      { predicate: `${WDT}P800`, direction: 'out', limit: 8, label: 'notable work' },
      { predicate: `${WDT}P937`, direction: 'out', limit: 4, label: 'work location' },
      { predicate: `${WDT}P463`, direction: 'out', limit: 6, label: 'member of' },
      { predicate: `${WDT}P161`, direction: 'in', limit: 10, label: 'cast in' },
      { predicate: `${WDT}P57`, direction: 'in', limit: 6, label: 'directed' },
      { predicate: `${WDT}P58`, direction: 'in', limit: 4, label: 'screenplay by' },
    ],
  },
  {
    id: 'awards',
    label: 'Awards',
    hint: 'Awards and nominations',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P166`, direction: 'out', limit: 12, label: 'award received' },
      { predicate: `${WDT}P1411`, direction: 'out', limit: 8, label: 'nominated for' },
    ],
  },
  {
    id: 'politics',
    label: 'Politics',
    hint: 'Party, offices, elections',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P102`, direction: 'out', limit: 4, label: 'political party' },
      { predicate: `${WDT}P39`, direction: 'out', limit: 8, label: 'position held' },
      { predicate: `${WDT}P3602`, direction: 'out', limit: 6, label: 'candidacy in election' },
      { predicate: `${WDT}P2715`, direction: 'out', limit: 4, label: 'elected in' },
    ],
  },
  {
    id: 'business',
    label: 'Business',
    hint: 'Employer, ownership, founded orgs',
    for: 'person',
    predicates: [
      { predicate: `${WDT}P108`, direction: 'out', limit: 8, label: 'employer' },
      { predicate: `${WDT}P1830`, direction: 'out', limit: 8, label: 'owner of' },
      { predicate: `${WDT}P112`, direction: 'in', limit: 6, label: 'founded' },
      { predicate: `${WDT}P127`, direction: 'in', limit: 6, label: 'owns' },
      { predicate: `${WDT}P3320`, direction: 'in', limit: 4, label: 'board member of' },
    ],
  },
]

/** Organization leadership — how you’d explore “CEOs / CTOs of top companies”. */
export const ORG_FACETS: KnowledgeFacet[] = [
  {
    id: 'leadership',
    label: 'Leadership',
    hint: 'CEO, board, directors, chairperson',
    for: 'org',
    predicates: [
      { predicate: `${WDT}P169`, direction: 'out', limit: 4, label: 'chief executive officer' },
      { predicate: `${WDT}P1037`, direction: 'out', limit: 4, label: 'director / manager' },
      { predicate: `${WDT}P3320`, direction: 'out', limit: 8, label: 'board member' },
      { predicate: `${WDT}P488`, direction: 'out', limit: 3, label: 'chairperson' },
      { predicate: `${WDT}P35`, direction: 'out', limit: 3, label: 'head of state' },
      { predicate: `${WDT}P6`, direction: 'out', limit: 3, label: 'head of government' },
      { predicate: `${WDT}P112`, direction: 'out', limit: 6, label: 'founded by' },
      { predicate: `${WDT}P127`, direction: 'out', limit: 4, label: 'owned by' },
      { predicate: `${WDT}P355`, direction: 'out', limit: 8, label: 'subsidiary' },
    ],
  },
  {
    id: 'identity',
    label: 'Identity',
    hint: 'Type, industry, headquarters, country',
    for: 'org',
    predicates: [
      { predicate: `${WDT}P31`, direction: 'out', limit: 4, label: 'instance of' },
      { predicate: `${WDT}P452`, direction: 'out', limit: 4, label: 'industry' },
      { predicate: `${WDT}P159`, direction: 'out', limit: 3, label: 'headquarters' },
      { predicate: `${WDT}P17`, direction: 'out', limit: 3, label: 'country' },
    ],
  },
]

/** Default seed mix for a person — complete dossier first paint. */
export const PERSON_SEED_FACET_IDS: FacetId[] = [
  'identity',
  'family',
  'career',
  'awards',
  'politics',
  'business',
]

export function facetsForKind(kind: 'person' | 'org' | 'other'): KnowledgeFacet[] {
  if (kind === 'person') return PERSON_FACETS
  if (kind === 'org') return ORG_FACETS
  return []
}

export function facetById(id: FacetId): KnowledgeFacet | undefined {
  return [...PERSON_FACETS, ...ORG_FACETS].find((f) => f.id === id)
}

/** Flatten predicates for seed (dedupe by predicate+direction). */
export function flattenFacetPredicates(facets: KnowledgeFacet[]): FacetPredicate[] {
  const seen = new Set<string>()
  const out: FacetPredicate[] = []
  for (const f of facets) {
    for (const p of f.predicates) {
      const k = `${p.direction}:${p.predicate}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push(p)
    }
  }
  return out
}

export const WDT_HUMAN = 'http://www.wikidata.org/entity/Q5'
export const WDT_ORG = 'http://www.wikidata.org/entity/Q43229'
export const WDT_BUSINESS = 'http://www.wikidata.org/entity/Q4830453'
export const WDT_COMPANY = 'http://www.wikidata.org/entity/Q783794'
