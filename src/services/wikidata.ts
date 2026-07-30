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
import { stampTreeHopDepths } from '../utils/treeLayout'
import {
  filterWikidataNodes,
  filterWikidataRelations,
  isWikidataNoiseObject,
  isWikidataNoisePredicate,
} from './wikidataNoise'

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
      FILTER(!CONTAINS(LCASE(STR(?o)), "/wiki/special:filepath"))
      FILTER(!REGEX(LCASE(STR(?o)), "\\\\.(jpe?g|png|gif|svg|webp)(\\\\?|#|$)"))
      OPTIONAL {
        ?prop <http://wikiba.se/ontology#directClaim> ?p .
        ?prop <http://www.w3.org/2000/01/rdf-schema#label> ?propLabel
        FILTER(LANG(?propLabel) = "en")
      }
    } LIMIT 50
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
    } LIMIT 20
  `

  const [outRows, inRows] = await Promise.all([
    runSparql(endpoint, outQuery, 12000),
    runSparql(endpoint, inQuery, 12000).catch(() => []),
  ])

  return filterWikidataRelations([
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
  ])
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

  if (isWikidataNoisePredicate(predicate)) return []

  const query = `
    SELECT DISTINCT ?node ?label WHERE {
      ${pattern}
      FILTER(isIRI(?node))
      FILTER(!CONTAINS(LCASE(STR(?node)), "/wiki/special:filepath"))
      FILTER(!REGEX(LCASE(STR(?node)), "\\\\.(jpe?g|png|gif|svg|webp)(\\\\?|#|$)"))
      OPTIONAL {
        ?node <http://www.w3.org/2000/01/rdf-schema#label> ?label
        FILTER(LANG(?label) = "en")
      }
    } LIMIT ${limit}
  `
  const rows = await runSparql(endpoint, query, 12000)
  return filterWikidataNodes(
    rows.map((r) => ({
      uri: r.node.value,
      label: r.label?.value || localName(r.node.value),
    })),
  )
}

const WDT_IMAGE = `${WDT}P18`
const WDT_LOGO = `${WDT}P154`

/** Extract commons filename from a Wikidata P18 / FilePath URI. */
export function commonsFileName(fileUri: string): string | null {
  if (!fileUri) return null
  try {
    let raw = fileUri.trim()
    if (/special:filepath/i.test(raw)) {
      const path = new URL(raw).pathname
      raw = path.replace(/.*\/Special:FilePath\//i, '')
    } else if (/\/wiki\/File:/i.test(raw) || /\/File:/i.test(raw)) {
      raw = raw.replace(/^.*\/(?:wiki\/)?File:/i, '')
    } else if (/^File:/i.test(raw)) {
      raw = raw.replace(/^File:/i, '')
    }
    const name = decodeURIComponent(raw.split('?')[0] || '').replace(/_/g, ' ').trim()
    return name && name.length <= 240 ? name : null
  } catch {
    return null
  }
}

/**
 * Resolve a commons file to a direct upload.wikimedia.org thumbnail (CORS-safe for canvas).
 * Special:FilePath redirects break Cytoscape background-image loads.
 */
export async function resolveCommonsThumb(
  fileUri: string,
  width = 360,
): Promise<string | null> {
  const name = commonsFileName(fileUri)
  if (!name) return null

  // Fast path: FilePath with width (works in <img>, not always on canvas)
  const filePathFallback = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`

  try {
    const api = new URL('https://commons.wikimedia.org/w/api.php')
    api.searchParams.set('action', 'query')
    api.searchParams.set('format', 'json')
    api.searchParams.set('origin', '*')
    api.searchParams.set('titles', `File:${name}`)
    api.searchParams.set('prop', 'imageinfo')
    api.searchParams.set('iiprop', 'url')
    api.searchParams.set('iiurlwidth', String(width))

    const res = await fetch(api.toString(), {
      signal: (() => {
        const c = new AbortController()
        window.setTimeout(() => c.abort(), 8000)
        return c.signal
      })(),
    })
    if (!res.ok) return filePathFallback
    const json = (await res.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> }
    }
    const pages = json.query?.pages
    if (!pages) return filePathFallback
    for (const page of Object.values(pages)) {
      const info = page.imageinfo?.[0]
      const url = info?.thumburl || info?.url
      if (url) return url
    }
    return filePathFallback
  } catch {
    return filePathFallback
  }
}

/** @deprecated use resolveCommonsThumb — kept for sync callers */
export function commonsImageUrl(fileUri: string, width = 320): string | null {
  const name = commonsFileName(fileUri)
  if (!name) return null
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=${width}`
}

/** Fetch entity portrait/logo for UI (never as a graph neighbor node). */
export async function wdEntityImage(
  endpoint: string,
  uri: string,
  width = 320,
): Promise<string | null> {
  const query = `
    SELECT ?img WHERE {
      { <${uri}> <${WDT_IMAGE}> ?img }
      UNION
      { <${uri}> <${WDT_LOGO}> ?img }
    } LIMIT 1
  `
  try {
    const rows = await runSparql(endpoint, query, 6000)
    const raw = rows[0]?.img?.value
    if (!raw) return null
    return await resolveCommonsThumb(raw, width)
  } catch {
    return null
  }
}

/** Classify Wikidata entity for curated dossier UX. */
export async function wdEntityKind(
  endpoint: string,
  uri: string,
): Promise<'person' | 'org' | 'work' | 'other'> {
  const query = `
    SELECT ?c WHERE {
      <${uri}> <${WDT_INSTANCE_OF}> ?c .
    } LIMIT 24
  `
  try {
    const rows = await runSparql(endpoint, query, 6000)
    const ids = rows.map((r) => {
      const v = r.c.value
      const m = v.match(/\/(Q\d+)$/)
      return m ? m[1] : v
    })
    if (ids.includes('Q5')) return 'person'
    const orgHints = [
      'Q43229', // organization
      'Q4830453', // business
      'Q783794', // company
      'Q6881511', // enterprise
      'Q891723', // public company
      'Q161726', // multinational
    ]
    if (ids.some((id) => orgHints.includes(id))) return 'org'

    const workHints = [
      'Q11424', // film
      'Q24856', // film series
      'Q5398426', // television series
      'Q15416', // television program
      'Q21191270', // television series episode
      'Q2431196', // audiovisual work
      'Q229390', // 3D film
      'Q506240', // television film
      'Q1364726', // short film
      'Q134556', // single (music)
      'Q7366', // song
      'Q482994', // album
      'Q208569', // album (studio)
      'Q222910', // compilation album
      'Q105543609', // musical work/composition
      'Q2188189', // musical work
      'Q7889', // video game
      'Q571', // book
      'Q7725634', // literary work
    ]
    if (ids.some((id) => workHints.includes(id))) return 'work'
    return 'other'
  } catch {
    return 'other'
  }
}

/** Wikidata P345 → https://www.imdb.com/title/… or /name/… */
export async function wdImdbUrl(
  endpoint: string,
  uri: string,
): Promise<string | null> {
  const query = `
    SELECT ?id WHERE {
      <${uri}> <${WDT}P345> ?id .
    } LIMIT 1
  `
  try {
    const rows = await runSparql(endpoint, query, 6000)
    const id = rows[0]?.id?.value?.trim()
    if (!id) return null
    if (/^tt\d+/i.test(id)) return `https://www.imdb.com/title/${id}/`
    if (/^nm\d+/i.test(id)) return `https://www.imdb.com/name/${id}/`
    return `https://www.imdb.com/find/?q=${encodeURIComponent(id)}`
  } catch {
    return null
  }
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
    if (isWikidataNoisePredicate(p) || isWikidataNoiseObject(o)) continue
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
  const nodeList = [...nodes.values()]
  const stamped = stampTreeHopDepths(nodeList, links, WD_ENTITY)
  return { nodes: stamped, links, rootId: WD_ENTITY }
}

const WDT_FATHER = `${WDT}P22`
const WDT_MOTHER = `${WDT}P25`
const WDT_SPOUSE = `${WDT}P26`
const WDT_CHILD = `${WDT}P40`
const WDT_SIBLING = `${WDT}P3373`

export const FAMILY_PRED_LABEL: Record<string, string> = {
  [WDT_FATHER]: 'father',
  [WDT_MOTHER]: 'mother',
  [WDT_SPOUSE]: 'spouse',
  [WDT_CHILD]: 'child',
  [WDT_SIBLING]: 'sibling',
}

export const MAX_FAMILY_NODES = 100
export const MAX_FAMILY_DEPTH = 5

type FamilyRole = NonNullable<GraphNode['__familyRole']>

interface FamilyEdgeRow {
  s: string
  p: string
  o: string
  oLabel: string
}

function valuesClause(uris: string[]): string {
  return uris.map((u) => `<${u}>`).join(' ')
}

/** One-hop family edges from a frontier (parents, children, spouses, siblings). */
async function wdFamilyEdges(
  endpoint: string,
  subjects: string[],
  kinds: Array<'up' | 'down' | 'side'>,
): Promise<FamilyEdgeRow[]> {
  if (!subjects.length) return []

  const parts: string[] = []
  if (kinds.includes('up')) {
    parts.push(`
      {
        VALUES ?s { ${valuesClause(subjects)} }
        VALUES ?p { <${WDT_FATHER}> <${WDT_MOTHER}> }
        ?s ?p ?o .
        FILTER(isIRI(?o))
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
      }`)
  }
  if (kinds.includes('down')) {
    parts.push(`
      {
        VALUES ?s { ${valuesClause(subjects)} }
        BIND(<${WDT_CHILD}> AS ?p)
        ?s ?p ?o .
        FILTER(isIRI(?o))
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
      }`)
  }
  if (kinds.includes('side')) {
    parts.push(`
      {
        VALUES ?s { ${valuesClause(subjects)} }
        VALUES ?p { <${WDT_SPOUSE}> <${WDT_SIBLING}> }
        ?s ?p ?o .
        FILTER(isIRI(?o))
        OPTIONAL {
          ?o <http://www.w3.org/2000/01/rdf-schema#label> ?oLabel
          FILTER(LANG(?oLabel) = "en")
        }
      }`)
  }
  if (!parts.length) return []

  const sparql = `
    SELECT ?s ?p ?o ?oLabel WHERE {
      ${parts.join('\n      UNION\n')}
    } LIMIT 240
  `

  try {
    const rows = await runSparql(endpoint, sparql, 14000)
    return rows
      .map((r) => ({
        s: r.s?.value ?? '',
        p: r.p?.value ?? '',
        o: r.o?.value ?? '',
        oLabel: r.oLabel?.value || localName(r.o?.value ?? ''),
      }))
      .filter((r) => r.s && r.p && r.o)
  } catch {
    return []
  }
}

function roleForPredicate(p: string, towardRelative: boolean): FamilyRole {
  if (p === WDT_FATHER || p === WDT_MOTHER) return towardRelative ? 'parent' : 'child'
  if (p === WDT_CHILD) return towardRelative ? 'child' : 'parent'
  if (p === WDT_SPOUSE) return 'spouse'
  return 'sibling'
}

/**
 * Multi-generation family tree from a person seed.
 * Ancestors via P22/P25, descendants via P40, lateral P26/P3373 at each band.
 */
export async function wdFamilyTree(
  endpoint: string,
  seedUri: string,
  depth: number,
): Promise<{ nodes: GraphNode[]; links: GraphLink[]; message: string }> {
  const d = Math.max(1, Math.min(MAX_FAMILY_DEPTH, Math.floor(depth)))
  const [seedLabel, imageUrl] = await Promise.all([
    wdLabel(endpoint, seedUri),
    wdEntityImage(endpoint, seedUri, 360),
  ])

  const nodes = new Map<string, GraphNode>()
  const links = new Map<string, GraphLink>()

  const ensure = (
    uri: string,
    label: string,
    gen: number,
    role: FamilyRole,
  ) => {
    if (nodes.size >= MAX_FAMILY_NODES && !nodes.has(uri)) return false
    const prev = nodes.get(uri)
    if (prev) {
      // Keep role closer to seed if already present; prefer non-sibling when upgrading
      if (role === 'seed' || (prev.__familyRole === 'sibling' && role !== 'sibling')) {
        prev.__familyRole = role
      }
      return true
    }
    nodes.set(uri, {
      id: uri,
      uri,
      label: label || localName(uri),
      type: 'resource',
      classes: ['Human'],
      __hopDepth: Math.abs(gen),
      __familyGen: gen,
      __familyRole: role,
      __imageUrl: uri === seedUri ? imageUrl || undefined : undefined,
      __pulse: uri === seedUri ? 1 : undefined,
    })
    return true
  }

  const addLink = (source: string, predicate: string, target: string) => {
    const id = linkId(source, predicate, target)
    if (links.has(id)) return
    links.set(id, {
      id,
      source,
      target,
      predicate,
      predicateLabel: FAMILY_PRED_LABEL[predicate] || localName(predicate),
    })
  }

  ensure(seedUri, seedLabel, 0, 'seed')

  let ancestorFrontier = [seedUri]
  let descendantFrontier = [seedUri]

  for (let step = 1; step <= d; step++) {
    if (nodes.size >= MAX_FAMILY_NODES) break

    // Ancestors
    if (ancestorFrontier.length) {
      const up = await wdFamilyEdges(endpoint, ancestorFrontier, ['up'])
      const nextAnc: string[] = []
      for (const row of up) {
        if (!ensure(row.o, row.oLabel, -step, 'parent')) continue
        addLink(row.s, row.p, row.o)
        nextAnc.push(row.o)
      }
      // Spouses/siblings of new ancestors
      if (nextAnc.length && nodes.size < MAX_FAMILY_NODES) {
        const side = await wdFamilyEdges(endpoint, nextAnc, ['side'])
        for (const row of side) {
          const role = roleForPredicate(row.p, true)
          if (!ensure(row.o, row.oLabel, -step, role)) continue
          addLink(row.s, row.p, row.o)
        }
      }
      ancestorFrontier = [...new Set(nextAnc)]
    }

    // Descendants
    if (descendantFrontier.length && nodes.size < MAX_FAMILY_NODES) {
      const down = await wdFamilyEdges(endpoint, descendantFrontier, ['down'])
      const nextDesc: string[] = []
      for (const row of down) {
        if (!ensure(row.o, row.oLabel, step, 'child')) continue
        addLink(row.s, row.p, row.o)
        nextDesc.push(row.o)
      }
      if (nextDesc.length && nodes.size < MAX_FAMILY_NODES) {
        const side = await wdFamilyEdges(endpoint, nextDesc, ['side'])
        for (const row of side) {
          const role = roleForPredicate(row.p, true)
          if (!ensure(row.o, row.oLabel, step, role)) continue
          addLink(row.s, row.p, row.o)
        }
      }
      descendantFrontier = [...new Set(nextDesc)]
    }
  }

  // Lateral relations around seed (spouse / siblings at gen 0)
  const seedSide = await wdFamilyEdges(endpoint, [seedUri], ['side'])
  for (const row of seedSide) {
    const role = roleForPredicate(row.p, true)
    if (!ensure(row.o, row.oLabel, 0, role)) continue
    addLink(row.s, row.p, row.o)
  }

  const nodeList = [...nodes.values()]
  const linkList = [...links.values()]
  const capped = nodeList.length >= MAX_FAMILY_NODES
  return {
    nodes: nodeList,
    links: linkList,
    message: capped
      ? `Family tree · depth ${d} · ${nodeList.length} people (capped)`
      : `Family tree · depth ${d} · ${nodeList.length} people · ${linkList.length} links`,
  }
}

