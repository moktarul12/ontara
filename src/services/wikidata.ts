import type {
  ConnectedNode,
  DataProperty,
  GraphLink,
  GraphNode,
  RelationType,
} from '../types/ontology'
import {
  WD_ENTITY,
  WDT_COUNTRY,
  WDT_INSTANCE_OF,
  WDT_SUBCLASS_OF,
  WIKIDATA_CORE_CLASSES,
} from '../types/ontology'
import { localName, runSparql } from './sparql-core'

const WDT = 'http://www.wikidata.org/prop/direct/'

function linkId(source: string, predicate: string, target: string) {
  return `${source}|${predicate}|${target}`
}

function escapeSparql(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

export async function wdLabel(endpoint: string, uri: string): Promise<string> {
  const query = `
    SELECT ?label WHERE {
      OPTIONAL {
        <${uri}> <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(LANG(?label) = "en")
      }
    } LIMIT 1
  `
  try {
    const rows = await runSparql(endpoint, query, 8000)
    return rows[0]?.label?.value || localName(uri)
  } catch {
    return localName(uri)
  }
}

export async function wdRelationTypes(
  endpoint: string,
  uri: string,
): Promise<RelationType[]> {
  const outQuery = `
    SELECT DISTINCT ?p ?propLabel WHERE {
      <${uri}> ?p ?o .
      FILTER(STRSTARTS(STR(?p), "${WDT}"))
      FILTER(isIRI(?o))
      OPTIONAL {
        ?prop <http://wikiba.se/ontology#directClaim> ?p .
        ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
        FILTER(LANG(?propLabel) = "en")
      }
    } LIMIT 30
  `
  const inQuery = `
    SELECT DISTINCT ?p ?propLabel WHERE {
      ?s ?p <${uri}> .
      FILTER(STRSTARTS(STR(?p), "${WDT}"))
      FILTER(isIRI(?s))
      OPTIONAL {
        ?prop <http://wikiba.se/ontology#directClaim> ?p .
        ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
        FILTER(LANG(?propLabel) = "en")
      }
    } LIMIT 15
  `

  const [outRows, inRows] = await Promise.all([
    runSparql(endpoint, outQuery, 12000),
    runSparql(endpoint, inQuery, 12000).catch(() => []),
  ])

  return [
    ...outRows.map((r) => ({
      predicate: r.p.value,
      predicateLabel: r.propLabel?.value || localName(r.p.value),
      count: -1,
      direction: 'out' as const,
    })),
    ...inRows.map((r) => ({
      predicate: r.p.value,
      predicateLabel: r.propLabel?.value || localName(r.p.value),
      count: -1,
      direction: 'in' as const,
    })),
  ]
}

export async function wdClassRelationTypes(): Promise<RelationType[]> {
  return [
    {
      predicate: WDT_SUBCLASS_OF,
      predicateLabel: 'subclass of (children)',
      count: -1,
      direction: 'in',
    },
    {
      predicate: WDT_SUBCLASS_OF,
      predicateLabel: 'subclass of (parent)',
      count: -1,
      direction: 'out',
    },
    {
      predicate: WDT_INSTANCE_OF,
      predicateLabel: 'instances (instance of)',
      count: -1,
      direction: 'in',
    },
  ]
}

export async function wdConnectedNodes(
  endpoint: string,
  uri: string,
  predicate: string,
  direction: 'out' | 'in',
  limit = 12,
): Promise<ConnectedNode[]> {
  const pattern =
    direction === 'out'
      ? `<${uri}> <${predicate}> ?node .`
      : `?node <${predicate}> <${uri}> .`

  const query = `
    SELECT DISTINCT ?node ?label WHERE {
      ${pattern}
      FILTER(isIRI(?node))
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(LANG(?label) = "en")
      }
    } LIMIT ${limit}
  `
  const rows = await runSparql(endpoint, query, 12000)
  return rows.map((r) => ({
    uri: r.node.value,
    label: r.label?.value || localName(r.node.value),
  }))
}

export async function wdDataProperties(
  endpoint: string,
  uri: string,
): Promise<DataProperty[]> {
  const query = `
    SELECT ?p ?v ?propLabel WHERE {
      {
        <${uri}> <http://schema.org/description> ?v .
        FILTER(LANG(?v) = "en")
        BIND(<http://schema.org/description> AS ?p)
        BIND("description" AS ?propLabel)
      } UNION {
        <${uri}> ?p ?v .
        FILTER(isLiteral(?v))
        FILTER(STRSTARTS(STR(?p), "${WDT}"))
        OPTIONAL {
          ?prop <http://wikiba.se/ontology#directClaim> ?p .
          ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
          FILTER(LANG(?propLabel) = "en")
        }
      }
    } LIMIT 40
  `
  try {
    const rows = await runSparql(endpoint, query, 12000)
    const seen = new Set<string>()
    const out: DataProperty[] = []
    for (const r of rows) {
      const key = `${r.p.value}|${r.v.value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        predicate: r.p.value,
        predicateLabel: r.propLabel?.value || localName(r.p.value),
        value: r.v.value,
        datatype: r.v.datatype,
        lang: r.v['xml:lang'],
      })
    }
    // Prefer description first
    return out.sort((a, b) => {
      if (a.predicate.includes('description')) return -1
      if (b.predicate.includes('description')) return 1
      return a.predicateLabel.localeCompare(b.predicateLabel)
    })
  } catch {
    return []
  }
}

export async function wdClasses(endpoint: string, uri: string): Promise<string[]> {
  const query = `
    SELECT DISTINCT ?c ?label WHERE {
      <${uri}> <${WDT_INSTANCE_OF}> ?c .
      OPTIONAL {
        ?c <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(LANG(?label) = "en")
      }
    } LIMIT 12
  `
  try {
    const rows = await runSparql(endpoint, query, 8000)
    return rows.map((r) => r.label?.value || localName(r.c.value))
  } catch {
    return []
  }
}

export async function wdSearch(
  endpoint: string,
  term: string,
  classFilter?: string,
  limit = 20,
): Promise<ConnectedNode[]> {
  const q = escapeSparql(term.trim())
  if (!q) return []

  const typeFilter = classFilter
    ? `?item <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classFilter}> .`
    : ''

  const query = `
    SELECT DISTINCT ?item ?itemLabel WHERE {
      SERVICE wikibase:mwapi {
        bd:serviceParam wikibase:api "EntitySearch" .
        bd:serviceParam wikibase:endpoint "www.wikidata.org" .
        bd:serviceParam mwapi:search "${q}" .
        bd:serviceParam mwapi:language "en" .
        bd:serviceParam mwapi:limit "${Math.min(limit, 20)}" .
        ?item wikibase:apiOutputItem mwapi:item .
      }
      ${typeFilter}
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
    } LIMIT ${limit}
  `

  try {
    const rows = await runSparql(endpoint, query, 15000)
    return rows.map((r) => ({
      uri: r.item.value,
      label: r.itemLabel?.value || localName(r.item.value),
      typeLabel: classFilter ? localName(classFilter) : undefined,
    }))
  } catch {
    // Fallback: English label CONTAINS
    const fallback = `
      SELECT DISTINCT ?item ?label WHERE {
        ${classFilter ? `?item <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classFilter}> .` : ''}
        ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label .
        FILTER(LANG(?label) = "en")
        FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${q}")))
      } LIMIT ${limit}
    `
    try {
      const rows = await runSparql(endpoint, fallback, 15000)
      return rows.map((r) => ({
        uri: r.item.value,
        label: r.label?.value || localName(r.item.value),
      }))
    } catch {
      return []
    }
  }
}

export async function wdSearchInContext(
  endpoint: string,
  options: {
    term?: string
    classUri?: string
    relatedToUri?: string
    limit?: number
  },
): Promise<ConnectedNode[]> {
  const { term = '', classUri, relatedToUri, limit = 25 } = options
  const q = escapeSparql(term.trim())

  if (!classUri && !relatedToUri) {
    if (!q) return []
    return wdSearch(endpoint, q, undefined, limit)
  }

  if (classUri && !relatedToUri) {
    if (!q) {
      const browse = `
        SELECT DISTINCT ?node ?label WHERE {
          ?node <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classUri}> .
          ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
          FILTER(LANG(?label) = "en")
        } LIMIT ${limit}
      `
      try {
        const rows = await runSparql(endpoint, browse, 14000)
        return rows.map((r) => ({
          uri: r.node.value,
          label: r.label?.value || localName(r.node.value),
          typeLabel: localName(classUri),
        }))
      } catch {
        return []
      }
    }
    return wdSearch(endpoint, q, classUri, limit)
  }

  // Within selected (e.g. India) + optional city class
  const typeClause = classUri
    ? `?node <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classUri}> .`
    : ''
  const labelFilter = q
    ? `
      ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label .
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${q}")))
    `
    : `
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(LANG(?label) = "en")
      }
    `

  const query = `
    SELECT DISTINCT ?node ?label WHERE {
      ${typeClause}
      {
        ?node <${WDT_COUNTRY}> <${relatedToUri}> .
      } UNION {
        ?node <${WDT}>P131 <${relatedToUri}> .
      } UNION {
        ?node <${WDT}>P276 <${relatedToUri}> .
      } UNION {
        <${relatedToUri}> <${WDT}>P36 ?node .
      }
      FILTER(?node != <${relatedToUri}>)
      ${labelFilter}
    } LIMIT ${limit}
  `

  try {
    const rows = await runSparql(endpoint, query, 16000)
    return rows.map((r) => ({
      uri: r.node.value,
      label: r.label?.value || localName(r.node.value),
      typeLabel: classUri ? localName(classUri) : undefined,
    }))
  } catch {
    if (q) return wdSearch(endpoint, q, classUri, limit)
    return []
  }
}

export async function wdClassMap(endpoint: string): Promise<{
  nodes: GraphNode[]
  links: GraphLink[]
  rootId: string
}> {
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
        __pulse: uri === WD_ENTITY ? 1 : undefined,
      })
    }
  }

  ensure(WD_ENTITY, 'Entity')
  for (const c of WIKIDATA_CORE_CLASSES) {
    ensure(c.uri, c.label)
    const id = linkId(c.uri, WDT_SUBCLASS_OF, c.parent)
    links.push({
      id,
      source: c.uri,
      target: c.parent,
      predicate: WDT_SUBCLASS_OF,
      predicateLabel: 'subclass of',
    })
  }

  // Enrich a couple hubs with live subclasses
  for (const hub of [
    'http://www.wikidata.org/entity/Q5',
    'http://www.wikidata.org/entity/Q515',
  ]) {
    try {
      const subs = await wdConnectedNodes(endpoint, hub, WDT_SUBCLASS_OF, 'in', 4)
      for (const s of subs) {
        ensure(s.uri, s.label)
        const id = linkId(s.uri, WDT_SUBCLASS_OF, hub)
        if (!links.some((l) => l.id === id)) {
          links.push({
            id,
            source: s.uri,
            target: hub,
            predicate: WDT_SUBCLASS_OF,
            predicateLabel: 'subclass of',
          })
        }
      }
    } catch {
      /* curated only */
    }
  }

  return { nodes: [...nodes.values()], links, rootId: WD_ENTITY }
}
