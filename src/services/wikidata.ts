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
import { localName, runSparql, searchWikidataApi } from './sparql-core'

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
  const q = term.trim()
  if (!q) return []

  // Fast path: MediaWiki wbsearchentities (~200ms)
  try {
    const hits = await searchWikidataApi(q, Math.min(limit * 2, 20))
    let mapped: ConnectedNode[] = hits.map((h) => ({
      uri: `http://www.wikidata.org/entity/${h.id}`,
      label: h.label,
      typeLabel: h.description,
    }))

    // Optional class filter via one SPARQL check on top hits
    if (classFilter && mapped.length) {
      const values = mapped
        .slice(0, 16)
        .map((m) => `<${m.uri}>`)
        .join(' ')
      const filterQ = `
        SELECT DISTINCT ?item WHERE {
          VALUES ?item { ${values} }
          ?item <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classFilter}> .
        }
      `
      try {
        const rows = await runSparql(endpoint, filterQ, 8000)
        const ok = new Set(rows.map((r) => r.item.value))
        mapped = mapped.filter((m) => ok.has(m.uri))
      } catch {
        /* keep unfiltered hits */
      }
    }

    if (mapped.length) return mapped.slice(0, limit)
  } catch {
    /* fall through to SPARQL */
  }

  const escaped = escapeSparql(q)
  const typeFilter = classFilter
    ? `?item <${WDT_INSTANCE_OF}>/<${WDT_SUBCLASS_OF}>* <${classFilter}> .`
    : ''
  const fallback = `
    SELECT DISTINCT ?item ?label WHERE {
      ${typeFilter}
      ?item <http://www.w3.org/2000/01/rdf-schema#label> ?label .
      FILTER(LANG(?label) = "en")
      FILTER(CONTAINS(LCASE(STR(?label)), LCASE("${escaped}")))
    } LIMIT ${limit}
  `
  try {
    const rows = await runSparql(endpoint, fallback, 12000)
    return rows.map((r) => ({
      uri: r.item.value,
      label: r.label?.value || localName(r.item.value),
    }))
  } catch {
    return []
  }
}

/** One SPARQL query: 1-hop star (outgoing + a few incoming). */
export async function wdEntityStar(
  endpoint: string,
  uri: string,
  limit = 36,
): Promise<{ nodes: GraphNode[]; links: GraphLink[]; label: string }> {
  const query = `
    SELECT ?p ?propLabel ?o ?oLabel ?dir WHERE {
      {
        BIND("out" AS ?dir)
        <${uri}> ?p ?o .
        FILTER(STRSTARTS(STR(?p), "${WDT}"))
        FILTER(isIRI(?o))
      } UNION {
        BIND("in" AS ?dir)
        ?o ?p <${uri}> .
        FILTER(STRSTARTS(STR(?p), "${WDT}"))
        FILTER(isIRI(?o))
      }
      OPTIONAL {
        ?prop <http://wikiba.se/ontology#directClaim> ?p .
        ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
        FILTER(LANG(?propLabel) = "en")
      }
      OPTIONAL {
        ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
        FILTER(LANG(?oLabel) = "en")
      }
    } LIMIT ${limit}
  `

  const labelPromise = wdLabel(endpoint, uri)
  const rows = await runSparql(endpoint, query, 14000)
  const label = await labelPromise

  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []
  nodes.set(uri, {
    id: uri,
    uri,
    label,
    type: 'resource',
    __pulse: 1,
  })

  for (const r of rows) {
    const o = r.o.value
    const p = r.p.value
    const dir = r.dir?.value === 'in' ? 'in' : 'out'
    if (!nodes.has(o)) {
      nodes.set(o, {
        id: o,
        uri: o,
        label: r.oLabel?.value || localName(o),
        type: 'resource',
      })
    }
    const from = dir === 'out' ? uri : o
    const to = dir === 'out' ? o : uri
    const id = linkId(from, p, to)
    if (!links.some((l) => l.id === id)) {
      links.push({
        id,
        source: from,
        target: to,
        predicate: p,
        predicateLabel: r.propLabel?.value || localName(p),
      })
    }
  }

  return { nodes: [...nodes.values()], links, label }
}

/** One SPARQL query for a BFS hop from frontier URIs. */
export async function wdHopLayer(
  endpoint: string,
  frontierUris: string[],
  direction: 'out' | 'in' | 'both',
  limit = 40,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const slice = frontierUris.slice(0, 8)
  if (!slice.length) return { nodes: [], links: [] }

  const values = slice.map((u) => `<${u}>`).join(' ')

  let query: string
  if (direction === 'out') {
    query = `
      SELECT ?s ?p ?propLabel ?o ?oLabel WHERE {
        VALUES ?s { ${values} }
        ?s ?p ?o .
        FILTER(STRSTARTS(STR(?p), "${WDT}"))
        FILTER(isIRI(?o))
        OPTIONAL {
          ?prop <http://wikiba.se/ontology#directClaim> ?p .
          ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
          FILTER(LANG(?propLabel) = "en")
        }
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
        BIND("out" AS ?dir)
      } LIMIT ${limit}
    `
  } else if (direction === 'in') {
    query = `
      SELECT ?s ?p ?propLabel ?o ?oLabel WHERE {
        VALUES ?center { ${values} }
        ?o ?p ?center .
        FILTER(STRSTARTS(STR(?p), "${WDT}"))
        FILTER(isIRI(?o))
        BIND(?center AS ?s)
        OPTIONAL {
          ?prop <http://wikiba.se/ontology#directClaim> ?p .
          ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
          FILTER(LANG(?propLabel) = "en")
        }
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
        BIND("in" AS ?dir)
      } LIMIT ${limit}
    `
  } else {
    query = `
      SELECT ?s ?p ?propLabel ?o ?oLabel ?dir WHERE {
        {
          BIND("out" AS ?dir)
          VALUES ?s { ${values} }
          ?s ?p ?o .
          FILTER(STRSTARTS(STR(?p), "${WDT}"))
          FILTER(isIRI(?o))
        } UNION {
          BIND("in" AS ?dir)
          VALUES ?center { ${values} }
          ?o ?p ?center .
          FILTER(STRSTARTS(STR(?p), "${WDT}"))
          FILTER(isIRI(?o))
          BIND(?center AS ?s)
        }
        OPTIONAL {
          ?prop <http://wikiba.se/ontology#directClaim> ?p .
          ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
          FILTER(LANG(?propLabel) = "en")
        }
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
      } LIMIT ${limit}
    `
  }

  const rows = await runSparql(endpoint, query, 14000)
  const nodes = new Map<string, GraphNode>()
  const links: GraphLink[] = []

  for (const r of rows) {
    const center = r.s.value
    const neighbor = r.o.value
    const p = r.p.value
    const dir = r.dir?.value === 'in' || direction === 'in' ? 'in' : 'out'

    if (!nodes.has(neighbor)) {
      nodes.set(neighbor, {
        id: neighbor,
        uri: neighbor,
        label: r.oLabel?.value || localName(neighbor),
        type: 'resource',
        __pulse: 1,
      })
    }

    const from = dir === 'out' ? center : neighbor
    const to = dir === 'out' ? neighbor : center
    const id = linkId(from, p, to)
    if (!links.some((l) => l.id === id)) {
      links.push({
        id,
        source: from,
        target: to,
        predicate: p,
        predicateLabel: r.propLabel?.value || localName(p),
      })
    }
  }

  return { nodes: [...nodes.values()], links }
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

/** Find entities that have a given data/object property matching value. */
export async function wdSearchByDataProperty(
  endpoint: string,
  options: {
    propertyUri: string
    value: string
    valueKind: 'literal' | 'entity'
    classUri?: string
    limit?: number
  },
): Promise<ConnectedNode[]> {
  const { propertyUri, valueKind, classUri, limit = 25 } = options
  const raw = options.value.trim()
  if (!raw || !propertyUri) return []

  const typeClause = classUri
    ? `{ ?item <${WDT_INSTANCE_OF}> <${classUri}> . } UNION { ?item <${WDT_INSTANCE_OF}> ?c . ?c <${WDT_SUBCLASS_OF}> <${classUri}> . }`
    : ''
  const escaped = escapeSparql(raw)

  if (valueKind === 'literal') {
    const query = `
      SELECT DISTINCT ?item ?itemLabel WHERE {
        ${typeClause}
        ?item <${propertyUri}> ?v .
        FILTER(CONTAINS(LCASE(STR(?v)), LCASE("${escaped}")))
        OPTIONAL {
          ?item <http://www.w3.org/2000/01/rdf-schema#label> ?itemLabel
          FILTER(LANG(?itemLabel) = "en")
        }
      } LIMIT ${limit}
    `
    try {
      const rows = await runSparql(endpoint, query, 16000)
      return rows.map((r) => ({
        uri: r.item.value,
        label: r.itemLabel?.value || localName(r.item.value),
        typeLabel: localName(propertyUri),
      }))
    } catch {
      return []
    }
  }

  // Entity-valued: resolve value to candidate IRIs, then match property
  let valueUris: string[] = []
  try {
    const hits = await searchWikidataApi(raw, 5)
    valueUris = hits.map((h) => `http://www.wikidata.org/entity/${h.id}`)
  } catch {
    /* label fallback below */
  }

  if (valueUris.length) {
    const values = valueUris.map((u) => `<${u}>`).join(' ')
    const query = `
      SELECT DISTINCT ?item ?itemLabel WHERE {
        ${typeClause}
        VALUES ?v { ${values} }
        ?item <${propertyUri}> ?v .
        OPTIONAL {
          ?item <http://www.w3.org/2000/01/rdf-schema#label> ?itemLabel
          FILTER(LANG(?itemLabel) = "en")
        }
      } LIMIT ${limit}
    `
    try {
      const rows = await runSparql(endpoint, query, 16000)
      if (rows.length) {
        return rows.map((r) => ({
          uri: r.item.value,
          label: r.itemLabel?.value || localName(r.item.value),
          typeLabel: localName(propertyUri),
        }))
      }
    } catch {
      /* fall through */
    }
  }

  // Fallback: match on the object's English label
  const fallback = `
    SELECT DISTINCT ?item ?itemLabel WHERE {
      ${typeClause}
      ?item <${propertyUri}> ?v .
      FILTER(isIRI(?v))
      ?v <http://www.w3.org/2000/01/rdf-schema#label> ?vLabel .
      FILTER(LANG(?vLabel) = "en")
      FILTER(CONTAINS(LCASE(STR(?vLabel)), LCASE("${escaped}")))
      OPTIONAL {
        ?item <http://www.w3.org/2000/01/rdf-schema#label> ?itemLabel
        FILTER(LANG(?itemLabel) = "en")
      }
    } LIMIT ${limit}
  `
  try {
    const rows = await runSparql(endpoint, fallback, 16000)
    return rows.map((r) => ({
      uri: r.item.value,
      label: r.itemLabel?.value || localName(r.item.value),
      typeLabel: localName(propertyUri),
    }))
  } catch {
    return []
  }
}

export async function wdClassMap(_endpoint: string): Promise<{
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

  // Curated map only — skip live enrich (keeps bootstrap fast)
  return { nodes: [...nodes.values()], links, rootId: WD_ENTITY }
}
