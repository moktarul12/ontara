export interface GraphNode {
  id: string
  label: string
  uri: string
  type: 'resource' | 'class' | 'literal'
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
  startMode: 'resource',
  source: 'wikidata',
}

export const SEARCH_TYPE_SCOPES_DBPEDIA = [
  { id: 'all', label: 'All', classUri: undefined as string | undefined },
  { id: 'person', label: 'Person', classUri: 'http://dbpedia.org/ontology/Person' },
  { id: 'city', label: 'City', classUri: 'http://dbpedia.org/ontology/City' },
  { id: 'place', label: 'Place', classUri: 'http://dbpedia.org/ontology/Place' },
  { id: 'organisation', label: 'Organisation', classUri: 'http://dbpedia.org/ontology/Organisation' },
] as const

/** Wikidata instance-of classes (P31). */
export const SEARCH_TYPE_SCOPES_WIKIDATA = [
  { id: 'all', label: 'All', classUri: undefined as string | undefined },
  { id: 'person', label: 'Person', classUri: 'http://www.wikidata.org/entity/Q5' },
  { id: 'city', label: 'City', classUri: 'http://www.wikidata.org/entity/Q515' },
  { id: 'place', label: 'Place', classUri: 'http://www.wikidata.org/entity/Q2221906' },
  { id: 'organisation', label: 'Organisation', classUri: 'http://www.wikidata.org/entity/Q43229' },
] as const

export type SearchTypeScopeId = (typeof SEARCH_TYPE_SCOPES_WIKIDATA)[number]['id']

export function searchScopesForSource(source: SparqlSourceId) {
  return source === 'wikidata' ? SEARCH_TYPE_SCOPES_WIKIDATA : SEARCH_TYPE_SCOPES_DBPEDIA
}

export const SEARCH_EXAMPLES_WIKIDATA = [
  { label: 'Albert Einstein', uri: 'http://www.wikidata.org/entity/Q937' },
  { label: 'Paris', uri: 'http://www.wikidata.org/entity/Q90' },
  { label: 'India', uri: 'http://www.wikidata.org/entity/Q668' },
  { label: 'Marie Curie', uri: 'http://www.wikidata.org/entity/Q7186' },
] as const

export const SEARCH_EXAMPLES_DBPEDIA = [
  { label: 'Albert Einstein', uri: 'http://dbpedia.org/resource/Albert_Einstein' },
  { label: 'Paris', uri: 'http://dbpedia.org/resource/Paris' },
  { label: 'India', uri: 'http://dbpedia.org/resource/India' },
  { label: 'Marie Curie', uri: 'http://dbpedia.org/resource/Marie_Curie' },
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
