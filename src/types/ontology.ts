export interface GraphNode {
  id: string
  label: string
  uri: string
  /** relation = ontology property hub (Director, Genre…) between entity and values */
  type: 'resource' | 'class' | 'literal' | 'relation'
  classes?: string[]
  dataProperties?: DataProperty[]
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
  __degree?: number
  __pulse?: number
  /**
   * Entity-distance hop from seed (hubs are view chips and do not add hop).
   * 0 = seed, 1 = direct neighbors, 2+ = further entities.
   */
  __hopDepth?: number
  /** Groups value cards with their relation hub (Sholay-style clusters). */
  __clusterKey?: string
  __parentId?: string
  __predicate?: string
  __direction?: 'out' | 'in'
}

export interface GraphLink {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  predicate: string
  predicateLabel: string
  bidirectional?: boolean
}

export interface DataProperty {
  predicate: string
  predicateLabel: string
  value: string
  datatype?: string
  lang?: string
}

export interface RelationType {
  predicate: string
  predicateLabel: string
  count: number
  direction: 'out' | 'in'
}

export interface ConnectedNode {
  uri: string
  label: string
  typeLabel?: string
  selected?: boolean
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

export type StartMode = 'classmap' | 'resource'

export type SparqlSourceId = 'wikidata' | 'dbpedia'

export interface OntologyConfig {
  endpoint: string
  seedUri: string
  seedLabel: string
  startMode: StartMode
  source: SparqlSourceId
}

export const WIKIDATA_ENDPOINT = 'https://query.wikidata.org/sparql'
export const DBPEDIA_ENDPOINT = 'https://dbpedia.org/sparql'

export const SPARQL_SOURCES: {
  id: SparqlSourceId
  label: string
  endpoint: string
}[] = [
  { id: 'wikidata', label: 'Wikidata', endpoint: WIKIDATA_ENDPOINT },
  { id: 'dbpedia', label: 'DBpedia', endpoint: DBPEDIA_ENDPOINT },
]

/** OWL Thing — real root of the class hierarchy (DBpedia browse). */
export const OWL_THING = 'http://www.w3.org/2002/07/owl#Thing'

/** Wikidata “entity” / high-level types for class map. */
export const WD_ENTITY = 'http://www.wikidata.org/entity/Q35120'

export const CORE_ONTOLOGY_CLASSES: {
  uri: string
  label: string
  parent: string
}[] = [
  { uri: 'http://dbpedia.org/ontology/Agent', label: 'Agent', parent: OWL_THING },
  { uri: 'http://dbpedia.org/ontology/Person', label: 'Person', parent: 'http://dbpedia.org/ontology/Agent' },
  { uri: 'http://dbpedia.org/ontology/Organisation', label: 'Organisation', parent: 'http://dbpedia.org/ontology/Agent' },
  { uri: 'http://dbpedia.org/ontology/Place', label: 'Place', parent: OWL_THING },
  { uri: 'http://dbpedia.org/ontology/Work', label: 'Work', parent: OWL_THING },
  { uri: 'http://dbpedia.org/ontology/Event', label: 'Event', parent: OWL_THING },
  { uri: 'http://dbpedia.org/ontology/Species', label: 'Species', parent: OWL_THING },
  { uri: 'http://dbpedia.org/ontology/Activity', label: 'Activity', parent: OWL_THING },
]

export const WIKIDATA_CORE_CLASSES: {
  uri: string
  label: string
  parent: string
}[] = [
  { uri: 'http://www.wikidata.org/entity/Q5', label: 'Human', parent: WD_ENTITY },
  { uri: 'http://www.wikidata.org/entity/Q515', label: 'City', parent: WD_ENTITY },
  { uri: 'http://www.wikidata.org/entity/Q6256', label: 'Country', parent: WD_ENTITY },
  { uri: 'http://www.wikidata.org/entity/Q43229', label: 'Organization', parent: WD_ENTITY },
  { uri: 'http://www.wikidata.org/entity/Q386724', label: 'Work', parent: WD_ENTITY },
  { uri: 'http://www.wikidata.org/entity/Q1656682', label: 'Event', parent: WD_ENTITY },
]

export const DEFAULT_CONFIG: OntologyConfig = {
  endpoint: WIKIDATA_ENDPOINT,
  seedUri: '',
  seedLabel: '',
  startMode: 'classmap',
  source: 'wikidata',
}

export const SEARCH_TYPE_SCOPES_DBPEDIA = [
  { id: 'all', label: 'All', classUri: undefined as string | undefined },
  { id: 'person', label: 'Person', classUri: 'http://dbpedia.org/ontology/Person' },
  { id: 'work', label: 'Work / Film', classUri: 'http://dbpedia.org/ontology/Work' },
  { id: 'city', label: 'City', classUri: 'http://dbpedia.org/ontology/City' },
  { id: 'place', label: 'Place', classUri: 'http://dbpedia.org/ontology/Place' },
  { id: 'organisation', label: 'Organisation', classUri: 'http://dbpedia.org/ontology/Organisation' },
] as const

/** Wikidata instance-of classes (P31). */
export const SEARCH_TYPE_SCOPES_WIKIDATA = [
  { id: 'all', label: 'All', classUri: undefined as string | undefined },
  { id: 'person', label: 'Person', classUri: 'http://www.wikidata.org/entity/Q5' },
  { id: 'work', label: 'Work / Film', classUri: 'http://www.wikidata.org/entity/Q11424' },
  { id: 'city', label: 'City', classUri: 'http://www.wikidata.org/entity/Q515' },
  { id: 'place', label: 'Place', classUri: 'http://www.wikidata.org/entity/Q2221906' },
  { id: 'organisation', label: 'Organisation', classUri: 'http://www.wikidata.org/entity/Q43229' },
] as const

export type SearchTypeScopeId =
  | (typeof SEARCH_TYPE_SCOPES_WIKIDATA)[number]['id']
  | (typeof SEARCH_TYPE_SCOPES_DBPEDIA)[number]['id']

export function searchScopesForSource(source: SparqlSourceId) {
  return source === 'wikidata' ? SEARCH_TYPE_SCOPES_WIKIDATA : SEARCH_TYPE_SCOPES_DBPEDIA
}

export type SearchMode = 'entity' | 'dataprop'
export type DataPropertyValueKind = 'literal' | 'entity'

/** Curated data properties for Property + Value search. */
export interface DataPropertySearchDef {
  id: string
  label: string
  /** How to match the user value */
  valueKind: DataPropertyValueKind
  wikidataUri: string
  dbpediaUri: string
}

export const DATA_PROPERTY_SEARCH_DEFS: DataPropertySearchDef[] = [
  {
    id: 'description',
    label: 'Description',
    valueKind: 'literal',
    wikidataUri: 'http://schema.org/description',
    dbpediaUri: 'http://dbpedia.org/ontology/abstract',
  },
  {
    id: 'birthDate',
    label: 'Birth / inception date',
    valueKind: 'literal',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P569',
    dbpediaUri: 'http://dbpedia.org/ontology/birthDate',
  },
  {
    id: 'inception',
    label: 'Inception / founded',
    valueKind: 'literal',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P571',
    dbpediaUri: 'http://dbpedia.org/ontology/foundingDate',
  },
  {
    id: 'country',
    label: 'Country',
    valueKind: 'entity',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P17',
    dbpediaUri: 'http://dbpedia.org/ontology/country',
  },
  {
    id: 'filmingLocation',
    label: 'Filming location',
    valueKind: 'entity',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P915',
    dbpediaUri: 'http://dbpedia.org/ontology/filmingLocation',
  },
  {
    id: 'genre',
    label: 'Genre',
    valueKind: 'entity',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P136',
    dbpediaUri: 'http://dbpedia.org/ontology/genre',
  },
  {
    id: 'award',
    label: 'Award received',
    valueKind: 'entity',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P166',
    dbpediaUri: 'http://dbpedia.org/ontology/award',
  },
  {
    id: 'publicationDate',
    label: 'Publication / release date',
    valueKind: 'literal',
    wikidataUri: 'http://www.wikidata.org/prop/direct/P577',
    dbpediaUri: 'http://dbpedia.org/ontology/releaseDate',
  },
]

export function dataPropertyUriForSource(
  def: DataPropertySearchDef,
  source: SparqlSourceId,
): string {
  return source === 'wikidata' ? def.wikidataUri : def.dbpediaUri
}

export const SEARCH_EXAMPLES_WIKIDATA = [
  { label: 'The Dark Knight', uri: 'http://www.wikidata.org/entity/Q163872' },
  { label: 'Albert Einstein', uri: 'http://www.wikidata.org/entity/Q937' },
  { label: 'Paris', uri: 'http://www.wikidata.org/entity/Q90' },
  { label: 'Marie Curie', uri: 'http://www.wikidata.org/entity/Q7186' },
] as const

export const SEARCH_EXAMPLES_DBPEDIA = [
  { label: 'The Dark Knight', uri: 'http://dbpedia.org/resource/The_Dark_Knight_(film)' },
  { label: 'Albert Einstein', uri: 'http://dbpedia.org/resource/Albert_Einstein' },
  { label: 'Paris', uri: 'http://dbpedia.org/resource/Paris' },
  { label: 'Marie Curie', uri: 'http://dbpedia.org/resource/Marie_Curie' },
] as const

export const DATA_PROP_SEARCH_EXAMPLES = [
  { propertyId: 'filmingLocation', value: 'London', classId: 'work' as const },
  { propertyId: 'birthDate', value: '1879', classId: 'person' as const },
  { propertyId: 'country', value: 'India', classId: 'all' as const },
  { propertyId: 'genre', value: 'superhero', classId: 'work' as const },
] as const

export function searchExamplesForSource(source: SparqlSourceId) {
  return source === 'wikidata' ? SEARCH_EXAMPLES_WIKIDATA : SEARCH_EXAMPLES_DBPEDIA
}

/** @deprecated use searchScopesForSource */
export const SEARCH_TYPE_SCOPES = SEARCH_TYPE_SCOPES_WIKIDATA

/** @deprecated use searchExamplesForSource */
export const SEARCH_EXAMPLES = SEARCH_EXAMPLES_WIKIDATA

export const PRESET_SEEDS = SEARCH_EXAMPLES_DBPEDIA

export const RDFS_SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
export const WDT_INSTANCE_OF = 'http://www.wikidata.org/prop/direct/P31'
export const WDT_SUBCLASS_OF = 'http://www.wikidata.org/prop/direct/P279'
export const WDT_COUNTRY = 'http://www.wikidata.org/prop/direct/P17'
