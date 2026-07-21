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

export interface OntologyConfig {
  endpoint: string
  seedUri: string
  seedLabel: string
  startMode: StartMode
}

/** OWL Thing — real root of the class hierarchy, not the Wikipedia “Ontology” article. */
export const OWL_THING = 'http://www.w3.org/2002/07/owl#Thing'

/** Curated DBpedia ontology backbone shown on first load. */
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

export const DEFAULT_CONFIG: OntologyConfig = {
  endpoint: 'https://dbpedia.org/sparql',
  seedUri: '',
  seedLabel: '',
  startMode: 'resource',
}

export const SEARCH_TYPE_SCOPES = [
  { id: 'all', label: 'All', classUri: undefined },
  { id: 'person', label: 'Person', classUri: 'http://dbpedia.org/ontology/Person' },
  { id: 'city', label: 'City', classUri: 'http://dbpedia.org/ontology/City' },
  { id: 'place', label: 'Place', classUri: 'http://dbpedia.org/ontology/Place' },
  { id: 'organisation', label: 'Organisation', classUri: 'http://dbpedia.org/ontology/Organisation' },
] as const

export type SearchTypeScopeId = (typeof SEARCH_TYPE_SCOPES)[number]['id']

export const SEARCH_EXAMPLES = [
  { label: 'Albert Einstein', uri: 'http://dbpedia.org/resource/Albert_Einstein' },
  { label: 'Paris', uri: 'http://dbpedia.org/resource/Paris' },
  { label: 'India', uri: 'http://dbpedia.org/resource/India' },
  { label: 'Marie Curie', uri: 'http://dbpedia.org/resource/Marie_Curie' },
] as const

/** Example entities — for diving into instances after the class map. */
export const PRESET_SEEDS = [
  {
    label: 'Albert Einstein',
    uri: 'http://dbpedia.org/resource/Albert_Einstein',
  },
  {
    label: 'Paris',
    uri: 'http://dbpedia.org/resource/Paris',
  },
  {
    label: 'Machine learning',
    uri: 'http://dbpedia.org/resource/Machine_learning',
  },
  {
    label: 'Semantic Web',
    uri: 'http://dbpedia.org/resource/Semantic_Web',
  },
  {
    label: 'UNESCO',
    uri: 'http://dbpedia.org/resource/UNESCO',
  },
] as const

export const RDFS_SUBCLASS = 'http://www.w3.org/2000/01/rdf-schema#subClassOf'
