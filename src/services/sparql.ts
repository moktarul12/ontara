import type {
  ConnectedNode,
  DataProperty,
  DataPropertyValueKind,
  GraphLink,
  GraphNode,
  RelationType,
} from '../types/ontology'
import {
  CORE_ONTOLOGY_CLASSES,
  OWL_THING,
  RDFS_SUBCLASS,
  WD_ENTITY,
} from '../types/ontology'
import {
  isWikidataEndpoint,
  localName,
  predicateLabel,
  runSparql,
  type SparqlBinding,
} from './sparql-core'
import * as wd from './wikidata'

export {
  isWikidataEndpoint,
  localName,
  predicateLabel,
  runSparql,
} from './sparql-core'

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
const LABEL_PREDICATES = [
  'http://www.w3.org/2000/01/rdf-schema#label',
  'http://xmlns.com/foaf/0.1/name',
]

const WD_CLASS_IDS = new Set([
  'Q5',
  'Q515',
  'Q6256',
  'Q43229',
  'Q386724',
  'Q1656682',
  'Q2221906',
  'Q35120',
])

export function isOntologyClassUri(uri: string): boolean {
  if (!uri) return false
  if (
    uri === OWL_THING ||
    uri === WD_ENTITY ||
    uri.startsWith('http://dbpedia.org/ontology/') ||
    uri.endsWith('#Thing') ||
    uri.includes('owl#Class')
  ) {
    return true
  }
  // Exact Wikidata Q-id match only (endsWith caused false positives, e.g. …Q143229)
  const wd = uri.match(/\/entity\/(Q\d+)$/)
  if (wd) return WD_CLASS_IDS.has(wd[1])
  return false
}

export async function fetchResourceLabel(
  endpoint: string,
  uri: string,
): Promise<string> {
  if (isWikidataEndpoint(endpoint)) return wd.wdLabel(endpoint, uri)
  const query = `
    SELECT ?label WHERE {
      OPTIONAL { <${uri}> <${LABEL_PREDICATES[0]}> ?l1 FILTER(langMatches(lang(?l1), "en") || lang(?l1) = "") }
      OPTIONAL { <${uri}> <${LABEL_PREDICATES[1]}> ?l2 }
      BIND(COALESCE(?l1, ?l2) AS ?label)
    } LIMIT 1
  `
  try {
    const rows = await runSparql(endpoint, query, 8000)
    return rows[0]?.label?.value || localName(uri)
  } catch {
    return localName(uri)
  }
}

export async function fetchRelationTypes(
  endpoint: string,
  uri: string,
): Promise<RelationType[]> {
  if (isWikidataEndpoint(endpoint)) {
    if (isOntologyClassUri(uri)) return wd.wdClassRelationTypes()
    return wd.wdRelationTypes(endpoint, uri)
  }
  if (isOntologyClassUri(uri)) return fetchClassRelationTypes(endpoint, uri)
  return fetchResourceRelationTypes(endpoint, uri)
}

async function fetchClassRelationTypes(
  endpoint: string,
  uri: string,
): Promise<RelationType[]> {
  // Instant curated actions for classes — no heavy GROUP BY COUNT
  const curated: RelationType[] = [
    {
      predicate: RDFS_SUBCLASS,
      predicateLabel: 'subClassOf (children)',
      count: -1,
      direction: 'in',
    },
    {
      predicate: RDFS_SUBCLASS,
      predicateLabel: 'subClassOf (parent)',
      count: -1,
      direction: 'out',
    },
    {
      predicate: RDF_TYPE,
      predicateLabel: 'instances (type)',
      count: -1,
      direction: 'in',
    },
  ]

  // Light sample of other outgoing object properties (no COUNT)
  try {
    const rows = await runSparql(
      endpoint,
      `
      SELECT DISTINCT ?p WHERE {
        <${uri}> ?p ?o .
        FILTER(isIRI(?o))
        FILTER(?p != <${RDFS_SUBCLASS}>)
        FILTER(?p != <${RDF_TYPE}>)
        FILTER(!STRSTARTS(STR(?p), "http://www.w3.org/1999/02/22-rdf-syntax-ns#"))
        FILTER(?p != <http://www.w3.org/2000/01/rdf-schema#label>)
        FILTER(?p != <http://www.w3.org/2000/01/rdf-schema#comment>)
      } LIMIT 12
    `,
      8000,
    )
    for (const r of rows) {
      curated.push({
        predicate: r.p.value,
        predicateLabel: predicateLabel(r.p.value),
        count: -1,
        direction: 'out',
      })
    }
  } catch {
    /* curated still usable */
  }

  return curated
}

async function fetchResourceRelationTypes(
  endpoint: string,
  uri: string,
): Promise<RelationType[]> {
  // Sample distinct predicates — cheaper than COUNT GROUP BY on DBpedia
  const outQuery = `
    SELECT DISTINCT ?p WHERE {
      <${uri}> ?p ?o .
      FILTER(isIRI(?o))
      FILTER(!STRSTARTS(STR(?p), "http://www.w3.org/1999/02/22-rdf-syntax-ns#"))
      FILTER(?p != <http://www.w3.org/2000/01/rdf-schema#label>)
      FILTER(?p != <http://www.w3.org/2000/01/rdf-schema#comment>)
      FILTER(?p != <http://xmlns.com/foaf/0.1/name>)
      FILTER(?p != <http://dbpedia.org/ontology/abstract>)
      FILTER(?p != <http://dbpedia.org/ontology/wikiPageWikiLink>)
      FILTER(?p != <http://dbpedia.org/ontology/wikiPageRedirects>)
      FILTER(?p != <http://dbpedia.org/ontology/wikiPageExternalLink>)
      FILTER(?p != <http://www.w3.org/2002/07/owl#sameAs>)
      FILTER(?p != <http://purl.org/dc/terms/subject>)
    } LIMIT 30
  `

  const inQuery = `
    SELECT DISTINCT ?p WHERE {
      ?s ?p <${uri}> .
      FILTER(isIRI(?s))
      FILTER(?p != <http://dbpedia.org/ontology/wikiPageWikiLink>)
      FILTER(?p != <http://dbpedia.org/ontology/wikiPageRedirects>)
      FILTER(?p != <http://www.w3.org/2002/07/owl#sameAs>)
    } LIMIT 15
  `

  const [outRows, inRows] = await Promise.all([
    runSparql(endpoint, outQuery, 10000),
    runSparql(endpoint, inQuery, 10000).catch(() => [] as SparqlBinding[]),
  ])

  return [
    ...outRows.map((r) => ({
      predicate: r.p.value,
      predicateLabel: predicateLabel(r.p.value),
      count: -1,
      direction: 'out' as const,
    })),
    ...inRows.map((r) => ({
      predicate: r.p.value,
      predicateLabel: predicateLabel(r.p.value),
      count: -1,
      direction: 'in' as const,
    })),
  ]
}

export async function fetchConnectedNodes(
  endpoint: string,
  uri: string,
  predicate: string,
  direction: 'out' | 'in',
  limit = 12,
): Promise<ConnectedNode[]> {
  if (isWikidataEndpoint(endpoint)) {
    return wd.wdConnectedNodes(endpoint, uri, predicate, direction, limit)
  }
  // Keep queries lean — labels only, no nested type lookups
  const query =
    direction === 'out'
      ? `
    SELECT DISTINCT ?node ?label WHERE {
      <${uri}> <${predicate}> ?node .
      FILTER(isIRI(?node))
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      }
    } LIMIT ${limit}
  `
      : `
    SELECT DISTINCT ?node ?label WHERE {
      ?node <${predicate}> <${uri}> .
      FILTER(isIRI(?node))
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      }
    } LIMIT ${limit}
  `

  const rows = await runSparql(endpoint, query, 12000)
  const seen = new Set<string>()
  const nodes: ConnectedNode[] = []

  for (const r of rows) {
    const nodeUri = r.node.value
    if (seen.has(nodeUri)) continue
    seen.add(nodeUri)
    nodes.push({
      uri: nodeUri,
      label: r.label?.value || localName(nodeUri),
      typeLabel: isOntologyClassUri(nodeUri) ? 'Class' : undefined,
    })
  }

  return nodes
}

export async function fetchDataProperties(
  endpoint: string,
  uri: string,
): Promise<DataProperty[]> {
  if (isWikidataEndpoint(endpoint)) return wd.wdDataProperties(endpoint, uri)
  if (isOntologyClassUri(uri) && uri === OWL_THING) return []

  const query = `
    SELECT ?p ?v WHERE {
      <${uri}> ?p ?v .
      FILTER(isLiteral(?v))
      FILTER(
        !STRSTARTS(STR(?p), "http://dbpedia.org/ontology/abstract")
        || langMatches(lang(?v), "en")
        || lang(?v) = ""
      )
    } LIMIT 40
  `

  try {
    const rows = await runSparql(endpoint, query, 10000)
    const seen = new Set<string>()
    const unique: DataProperty[] = []
    for (const r of rows) {
      const key = `${r.p.value}|${r.v.value}`
      if (seen.has(key)) continue
      seen.add(key)
      unique.push({
        predicate: r.p.value,
        predicateLabel: predicateLabel(r.p.value),
        value: r.v.value,
        datatype: r.v.datatype,
        lang: r.v['xml:lang'],
      })
    }
    return unique.sort((a, b) => a.predicateLabel.localeCompare(b.predicateLabel))
  } catch {
    return []
  }
}

export async function fetchResourceClasses(
  endpoint: string,
  uri: string,
): Promise<string[]> {
  if (isWikidataEndpoint(endpoint)) return wd.wdClasses(endpoint, uri)
  if (isOntologyClassUri(uri)) return ['Class']

  const query = `
    SELECT DISTINCT ?c ?label WHERE {
      <${uri}> a ?c .
      OPTIONAL {
        ?c <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      }
      FILTER(!STRSTARTS(STR(?c), "http://www.w3.org/2002/07/owl#"))
      FILTER(!STRSTARTS(STR(?c), "http://www.w3.org/2000/01/rdf-schema#"))
    } LIMIT 12
  `
  try {
    const rows = await runSparql(endpoint, query, 8000)
    return rows.map((r) => r.label?.value || localName(r.c.value))
  } catch {
    return []
  }
}

export function looksLikePersonName(term: string): boolean {
  const t = term.trim()
  if (t.length < 2) return false
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return true
  return /^[A-Za-z][A-Za-z.'-]+$/.test(t) && t.length >= 3
}

function escapeSparql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function searchResources(
  endpoint: string,
  term: string,
  classFilter?: string,
  limit = 25,
): Promise<ConnectedNode[]> {
  if (isWikidataEndpoint(endpoint)) {
    return wd.wdSearch(endpoint, term, classFilter, limit)
  }
  const q = escapeSparql(term.trim())
  if (!q) return []

  const preferPerson = !classFilter && looksLikePersonName(term)
  const personClass = 'http://dbpedia.org/ontology/Person'
  const effectiveClass = classFilter || (preferPerson ? personClass : undefined)

  const mapRows = (rows: SparqlBinding[]): ConnectedNode[] =>
    rows.map((r) => ({
      uri: r.node.value,
      label: r.label?.value || localName(r.node.value),
      typeLabel: r.typeLabel?.value || (preferPerson && !classFilter ? 'Person' : undefined),
    }))

  // Virtuoso full-text first (DBpedia) — much better for names
  const ftClass = effectiveClass ? `?node a <${effectiveClass}> .` : ''
  const ftQuery = `
    SELECT DISTINCT ?node ?label ?typeLabel WHERE {
      ${ftClass}
      ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
      ?label bif:contains "'${q.replace(/'/g, "\\'")}'" .
      FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      OPTIONAL {
        ?node a ?type .
        FILTER(STRSTARTS(STR(?type), "http://dbpedia.org/ontology/"))
        ?type <http://www.w3.org/2000/01/rdf-schema#label> ?typeLabel
        FILTER(langMatches(lang(?typeLabel), "en") || lang(?typeLabel) = "")
      }
    } LIMIT ${limit}
  `

  try {
    const rows = await runSparql(endpoint, ftQuery, 12000)
    if (rows.length) return mapRows(rows)
  } catch {
    /* fall through */
  }

  // If person-biased search returned nothing, broaden without class filter
  const classClause = effectiveClass ? `?node a <${effectiveClass}> .` : ''
  const containsQuery = `
    SELECT DISTINCT ?node ?label ?typeLabel WHERE {
      ${classClause}
      ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
      FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${q}")))
      OPTIONAL {
        ?node a ?type .
        FILTER(STRSTARTS(STR(?type), "http://dbpedia.org/ontology/"))
        ?type <http://www.w3.org/2000/01/rdf-schema#label> ?typeLabel
        FILTER(langMatches(lang(?typeLabel), "en") || lang(?typeLabel) = "")
      }
    } LIMIT ${limit}
  `

  try {
    let rows = await runSparql(endpoint, containsQuery, 12000)
    if (!rows.length && effectiveClass && !classFilter) {
      const broad = `
        SELECT DISTINCT ?node ?label ?typeLabel WHERE {
          ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
          FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${q}")))
          OPTIONAL {
            ?node a ?type .
            FILTER(STRSTARTS(STR(?type), "http://dbpedia.org/ontology/"))
            ?type <http://www.w3.org/2000/01/rdf-schema#label> ?typeLabel
            FILTER(langMatches(lang(?typeLabel), "en") || lang(?typeLabel) = "")
          }
        } LIMIT ${limit}
      `
      rows = await runSparql(endpoint, broad, 12000)
    }
    return mapRows(rows)
  } catch {
    return []
  }
}

/**
 * Search with optional class scope (City, Person…) and/or "within selected node"
 * e.g. City + relatedTo India → cities in/of India; optional name filter.
 */
export async function searchInContext(
  endpoint: string,
  options: {
    term?: string
    classUri?: string
    relatedToUri?: string
    limit?: number
  },
): Promise<ConnectedNode[]> {
  if (isWikidataEndpoint(endpoint)) {
    return wd.wdSearchInContext(endpoint, options)
  }
  const { term = '', classUri, relatedToUri, limit = 25 } = options
  const q = escapeSparql(term.trim())

  // No context → normal search
  if (!classUri && !relatedToUri) {
    if (!q) return []
    return searchResources(endpoint, q, undefined, limit)
  }

  // Class only (e.g. City + "India") — instances of that class matching label
  if (classUri && !relatedToUri) {
    if (!q) {
      // Browse top-labeled instances of the class
      const browse = `
        SELECT DISTINCT ?node ?label WHERE {
          ?node a <${classUri}> .
          ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
        } LIMIT ${limit}
      `
      try {
        const rows = await runSparql(endpoint, browse, 12000)
        return rows.map((r) => ({
          uri: r.node.value,
          label: r.label?.value || localName(r.node.value),
          typeLabel: localName(classUri),
        }))
      } catch {
        return []
      }
    }
    return searchResources(endpoint, q, classUri, limit)
  }

  // Related to selected entity (e.g. India), optionally typed as City
  const classClause = classUri ? `?node a <${classUri}> .` : ''
  const labelClause = q
    ? `
      ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
      FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${q}")))
    `
    : `
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      }
    `

  const relatedQuery = `
    SELECT DISTINCT ?node ?label WHERE {
      ${classClause}
      {
        ?node <http://dbpedia.org/ontology/country> <${relatedToUri}> .
      } UNION {
        ?node <http://dbpedia.org/ontology/isPartOf> <${relatedToUri}> .
      } UNION {
        ?node <http://dbpedia.org/ontology/location> <${relatedToUri}> .
      } UNION {
        ?node <http://dbpedia.org/ontology/state> <${relatedToUri}> .
      } UNION {
        ?node <http://dbpedia.org/ontology/region> <${relatedToUri}> .
      } UNION {
        <${relatedToUri}> <http://dbpedia.org/ontology/capital> ?node .
      } UNION {
        <${relatedToUri}> <http://dbpedia.org/ontology/largestCity> ?node .
      } UNION {
        ?node ?rel <${relatedToUri}> .
        FILTER(isIRI(?node))
        FILTER(?rel != <http://dbpedia.org/ontology/wikiPageWikiLink>)
        FILTER(?rel != <http://www.w3.org/2002/07/owl#sameAs>)
      }
      FILTER(?node != <${relatedToUri}>)
      ${labelClause}
    } LIMIT ${limit}
  `

  try {
    const rows = await runSparql(endpoint, relatedQuery, 14000)
    return rows.map((r) => ({
      uri: r.node.value,
      label: r.label?.value || localName(r.node.value),
      typeLabel: classUri ? localName(classUri) : undefined,
    }))
  } catch {
    // Fallback: class filter + term only
    if (classUri && q) return searchResources(endpoint, q, classUri, limit)
    if (q) return searchResources(endpoint, q, classUri, limit)
    return []
  }
}

/** Search entities by a curated data/object property + value. */
export async function searchByDataProperty(
  endpoint: string,
  options: {
    propertyUri: string
    value: string
    valueKind: DataPropertyValueKind
    classUri?: string
    limit?: number
  },
): Promise<ConnectedNode[]> {
  if (isWikidataEndpoint(endpoint)) {
    return wd.wdSearchByDataProperty(endpoint, options)
  }

  const { propertyUri, valueKind, classUri, limit = 25 } = options
  const raw = options.value.trim()
  if (!raw || !propertyUri) return []
  const escaped = escapeSparql(raw)
  const typeClause = classUri ? `?item a <${classUri}> .` : ''

  if (valueKind === 'literal') {
    const ft = `
      SELECT DISTINCT ?item ?label WHERE {
        ${typeClause}
        ?item <${propertyUri}> ?v .
        FILTER(CONTAINS(LCASE(STR(?v)), LCASE("${escaped}")))
        OPTIONAL {
          ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label
          FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
        }
      } LIMIT ${limit}
    `
    try {
      const rows = await runSparql(endpoint, ft, 16000)
      return rows.map((r) => ({
        uri: r.item.value,
        label: r.label?.value || localName(r.item.value),
        typeLabel: localName(propertyUri),
      }))
    } catch {
      return []
    }
  }

  // Entity-valued: resolve value, then match
  let valueUris: string[] = []
  try {
    const hits = await searchResources(endpoint, raw, undefined, 5)
    valueUris = hits.map((h) => h.uri)
  } catch {
    /* label fallback */
  }

  if (valueUris.length) {
    const values = valueUris.map((u) => `<${u}>`).join(' ')
    const query = `
      SELECT DISTINCT ?item ?label WHERE {
        ${typeClause}
        VALUES ?v { ${values} }
        ?item <${propertyUri}> ?v .
        OPTIONAL {
          ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label
          FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
        }
      } LIMIT ${limit}
    `
    try {
      const rows = await runSparql(endpoint, query, 16000)
      if (rows.length) {
        return rows.map((r) => ({
          uri: r.item.value,
          label: r.label?.value || localName(r.item.value),
          typeLabel: localName(propertyUri),
        }))
      }
    } catch {
      /* fall through */
    }
  }

  const fallback = `
    SELECT DISTINCT ?item ?label WHERE {
      ${typeClause}
      ?item <${propertyUri}> ?v .
      FILTER(isIRI(?v))
      ?v <http://www.w3.org/2000/01/rdf-schema#label> ?vLabel .
      FILTER(langMatches(lang(?vLabel), "en") || lang(?vLabel) = "")
      FILTER(CONTAINS(LCASE(STR(?vLabel)), LCASE("${escaped}")))
      OPTIONAL {
        ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(langMatches(lang(?label), "en") || lang(?label) = "")
      }
    } LIMIT ${limit}
  `
  try {
    const rows = await runSparql(endpoint, fallback, 16000)
    return rows.map((r) => ({
      uri: r.item.value,
      label: r.label?.value || localName(r.item.value),
      typeLabel: localName(propertyUri),
    }))
  } catch {
    return []
  }
}

/** Attach up to 6 short data-property literals as graph nodes (concept-aligned). */
export function attachDataPropertyLiterals(
  centerUri: string,
  dataProperties: DataProperty[],
  nodes: GraphNode[],
  links: GraphLink[],
  max = 6,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const skip = /description|abstract|comment|wiki/i
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const linkIds = new Set(links.map((l) => l.id))
  let added = 0

  for (const p of dataProperties) {
    if (added >= max) break
    if (skip.test(p.predicateLabel) || skip.test(p.predicate)) continue
    const value = p.value.trim()
    if (!value || value.length > 80) continue
    // Prefer short facts (dates, numbers, short strings)
    if (value.length > 48 && !/^\d/.test(value)) continue

    const litId = `literal:${p.predicate}:${value.slice(0, 64)}`
    if (nodeMap.has(litId)) continue

    nodeMap.set(litId, {
      id: litId,
      uri: litId,
      label: value.length > 28 ? `${value.slice(0, 26)}…` : value,
      type: 'literal',
      classes: [p.predicateLabel],
      __pulse: 1,
    })

    const lid = linkId(centerUri, p.predicate, litId)
    if (!linkIds.has(lid)) {
      linkIds.add(lid)
      links.push({
        id: lid,
        source: centerUri,
        target: litId,
        predicate: p.predicate,
        predicateLabel: p.predicateLabel,
      })
    }
    added += 1
  }

  return { nodes: [...nodeMap.values()], links }
}

export async function searchClasses(
  endpoint: string,
  term: string,
  limit = 20,
): Promise<ConnectedNode[]> {
  const q = escapeSparql(term.trim())
  if (!q) return []

  const dboQuery = `
    SELECT DISTINCT ?node ?label WHERE {
      ?node a <http://www.w3.org/2002/07/owl#Class> .
      OPTIONAL { ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label }
      FILTER(STRSTARTS(STR(?node), "http://dbpedia.org/ontology/"))
      FILTER(CONTAINS(LCASE(STR(COALESCE(?label, STR(?node)))), LCASE("${q}")))
    } LIMIT ${limit}
  `
  const rows = await runSparql(endpoint, dboQuery, 12000)
  return rows.map((r) => ({
    uri: r.node.value,
    label: r.label?.value || localName(r.node.value),
    typeLabel: 'Class',
  }))
}

export interface EntityKnowledgeGraph {
  label: string
  classes: string[]
  dataProperties: DataProperty[]
  relationTypes: RelationType[]
  nodes: GraphNode[]
  links: GraphLink[]
  message: string
}

/** Build a 1-hop star knowledge graph for an entity (AWS Graph Explorer style). */
export async function fetchEntityKnowledgeGraph(
  endpoint: string,
  uri: string,
): Promise<EntityKnowledgeGraph> {
  // Wikidata: one SPARQL for the star + parallel meta
  if (isWikidataEndpoint(endpoint)) {
    const [star, classes, dataProperties, relationTypes] = await Promise.all([
      wd.wdEntityStar(endpoint, uri, 40),
      fetchResourceClasses(endpoint, uri),
      fetchDataProperties(endpoint, uri),
      fetchRelationTypes(endpoint, uri),
    ])

    const center = star.nodes.find((n) => n.id === uri)
    if (center) {
      center.classes = classes
      center.dataProperties = dataProperties
      center.type = isOntologyClassUri(uri) ? 'class' : 'resource'
    }

    const withLits = attachDataPropertyLiterals(
      uri,
      dataProperties,
      star.nodes,
      star.links,
      6,
    )

    return {
      label: star.label,
      classes,
      dataProperties,
      relationTypes,
      nodes: withLits.nodes,
      links: withLits.links,
      message: `Knowledge graph for ${star.label} — ${withLits.nodes.length - 1} connected · ${withLits.links.length} relations`,
    }
  }

  const [label, classes, dataProperties, relationTypes] = await Promise.all([
    fetchResourceLabel(endpoint, uri),
    fetchResourceClasses(endpoint, uri),
    fetchDataProperties(endpoint, uri),
    fetchRelationTypes(endpoint, uri),
  ])

  const center: GraphNode = {
    id: uri,
    uri,
    label,
    type: isOntologyClassUri(uri) ? 'class' : 'resource',
    classes,
    dataProperties,
    __pulse: 1,
  }

  const nodes = new Map<string, GraphNode>([[uri, center]])
  const links: GraphLink[] = []

  // Prefer outgoing relations for a readable star; take top 8
  const outgoing = relationTypes.filter((r) => r.direction === 'out').slice(0, 8)
  const incoming = relationTypes.filter((r) => r.direction === 'in').slice(0, 3)
  const toExpand = [...outgoing, ...incoming]

  await Promise.all(
    toExpand.map(async (rel) => {
      try {
        const neighbors = await fetchConnectedNodes(
          endpoint,
          uri,
          rel.predicate,
          rel.direction,
          4,
        )
        for (const n of neighbors) {
          if (!nodes.has(n.uri)) {
            nodes.set(n.uri, {
              id: n.uri,
              uri: n.uri,
              label: n.label,
              type: isOntologyClassUri(n.uri) ? 'class' : 'resource',
              classes: n.typeLabel ? [n.typeLabel] : undefined,
            })
          }
          const from = rel.direction === 'out' ? uri : n.uri
          const to = rel.direction === 'out' ? n.uri : uri
          const id = linkId(from, rel.predicate, to)
          if (!links.some((l) => l.id === id)) {
            links.push({
              id,
              source: from,
              target: to,
              predicate: rel.predicate,
              predicateLabel: rel.predicateLabel.replace(/\s*\(.*\)$/, ''),
            })
          }
        }
      } catch {
        /* skip slow relation */
      }
    }),
  )

  const edgeCount = links.length
  const neighborCount = nodes.size - 1

  const withLits = attachDataPropertyLiterals(
    uri,
    dataProperties,
    [...nodes.values()],
    links,
    6,
  )

  return {
    label,
    classes,
    dataProperties,
    relationTypes,
    nodes: withLits.nodes,
    links: withLits.links,
    message: `Knowledge graph for ${label} — ${withLits.nodes.length - 1} connected · ${withLits.links.length} relations`,
  }
}

export async function fetchSeedNeighborhood(
  endpoint: string,
  uri: string,
): Promise<{
  label: string
  classes: string[]
  relations: {
    predicate: string
    predicateLabel: string
    target: string
    targetLabel: string
  }[]
}> {
  const [label, classes, types] = await Promise.all([
    fetchResourceLabel(endpoint, uri),
    fetchResourceClasses(endpoint, uri),
    fetchRelationTypes(endpoint, uri),
  ])

  const top = types.filter((t) => t.direction === 'out').slice(0, 3)
  const relations: {
    predicate: string
    predicateLabel: string
    target: string
    targetLabel: string
  }[] = []

  await Promise.all(
    top.map(async (rel) => {
      const nodes = await fetchConnectedNodes(endpoint, uri, rel.predicate, 'out', 2)
      for (const n of nodes) {
        relations.push({
          predicate: rel.predicate,
          predicateLabel: rel.predicateLabel,
          target: n.uri,
          targetLabel: n.label,
        })
      }
    }),
  )

  return { label, classes, relations }
}

function linkId(source: string, predicate: string, target: string) {
  return `${source}|${predicate}|${target}`
}

async function fetchDirectSubclasses(
  endpoint: string,
  classUri: string,
  limit = 5,
): Promise<ConnectedNode[]> {
  return fetchConnectedNodes(endpoint, classUri, RDFS_SUBCLASS, 'in', limit)
}

export async function fetchOntologyClassMap(endpoint: string): Promise<{
  nodes: GraphNode[]
  links: GraphLink[]
  rootId: string
}> {
  if (isWikidataEndpoint(endpoint)) {
    return wd.wdClassMap(endpoint)
  }
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  const ensure = (uri: string, label: string) => {
    if (!nodes.has(uri)) {
      nodes.set(uri, {
        id: uri,
        uri,
        label,
        type: 'class',
        classes: ['Class'],
        __pulse: uri === OWL_THING ? 1 : undefined,
      })
    }
    return nodes.get(uri)!
  }

  const addSubclassEdge = (child: string, parent: string) => {
    const id = linkId(child, RDFS_SUBCLASS, parent)
    if (links.some((l) => l.id === id)) return
    links.push({
      id,
      source: child,
      target: parent,
      predicate: RDFS_SUBCLASS,
      predicateLabel: 'subClassOf',
    })
  }

  ensure(OWL_THING, 'Thing')

  for (const c of CORE_ONTOLOGY_CLASSES) {
    ensure(c.uri, c.label)
    ensure(c.parent, c.parent === OWL_THING ? 'Thing' : localName(c.parent))
    addSubclassEdge(c.uri, c.parent)
  }

  const hubs = [
    'http://dbpedia.org/ontology/Person',
    'http://dbpedia.org/ontology/Place',
    'http://dbpedia.org/ontology/Organisation',
    'http://dbpedia.org/ontology/Work',
  ]

  await Promise.all(
    hubs.map(async (hub) => {
      try {
        const subs = await fetchDirectSubclasses(endpoint, hub, 4)
        for (const s of subs) {
          ensure(s.uri, s.label)
          addSubclassEdge(s.uri, hub)
        }
      } catch {
        /* keep curated backbone */
      }
    }),
  )

  return {
    nodes: [...nodes.values()],
    links,
    rootId: OWL_THING,
  }
}

export type HopDirection = 'out' | 'in' | 'both'

/** One BFS hop from a set of frontier URIs — used for family-tree style expand. */
export async function fetchHopLayer(
  endpoint: string,
  frontierUris: string[],
  direction: HopDirection,
  options?: { maxNodes?: number; predsPerNode?: number; neighborsPerPred?: number },
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  if (isWikidataEndpoint(endpoint)) {
    const limit = (options?.maxNodes ?? 8) * (options?.neighborsPerPred ?? 4) * 2
    return wd.wdHopLayer(endpoint, frontierUris, direction, Math.min(limit, 50))
  }

  const maxNodes = options?.maxNodes ?? 10
  const predsPerNode = options?.predsPerNode ?? 4
  const neighborsPerPred = options?.neighborsPerPred ?? 3

  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  const slice = frontierUris.slice(0, maxNodes)

  await Promise.all(
    slice.map(async (uri) => {
      try {
        const types = await fetchRelationTypes(endpoint, uri)
        const dirs =
          direction === 'both'
            ? (['out', 'in'] as const)
            : ([direction] as const)

        for (const dir of dirs) {
          const preds = types.filter((t) => t.direction === dir).slice(0, predsPerNode)
          await Promise.all(
            preds.map(async (rel) => {
              try {
                const neighbors = await fetchConnectedNodes(
                  endpoint,
                  uri,
                  rel.predicate,
                  rel.direction,
                  neighborsPerPred,
                )
                for (const n of neighbors) {
                  if (!nodes.has(n.uri)) {
                    nodes.set(n.uri, {
                      id: n.uri,
                      uri: n.uri,
                      label: n.label,
                      type: isOntologyClassUri(n.uri) ? 'class' : 'resource',
                      classes: n.typeLabel ? [n.typeLabel] : undefined,
                      __pulse: 1,
                    })
                  }
                  const from = rel.direction === 'out' ? uri : n.uri
                  const to = rel.direction === 'out' ? n.uri : uri
                  const id = linkId(from, rel.predicate, to)
                  if (!links.some((l) => l.id === id)) {
                    links.push({
                      id,
                      source: from,
                      target: to,
                      predicate: rel.predicate,
                      predicateLabel: rel.predicateLabel.replace(/\s*\(.*\)$/, ''),
                    })
                  }
                }
              } catch {
                /* skip */
              }
            }),
          )
        }
      } catch {
        /* skip node */
      }
    }),
  )

  return { nodes: [...nodes.values()], links }
}
