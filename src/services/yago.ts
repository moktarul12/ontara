/**
 * YAGO 4 (yago-knowledge.org) helpers — schema.org + YAGO resource URIs.
 */
import type { ConnectedNode, GraphLink, GraphNode } from '../types/ontology'
import {
  OWL_THING,
  RDFS_SUBCLASS,
  YAGO_CORE_CLASSES,
} from '../types/ontology'
import { localName, runSparql, type SparqlBinding } from './sparql-core'
import { stampTreeHopDepths } from '../utils/treeLayout'

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'

function linkId(source: string, predicate: string, target: string) {
  return `${source}|${predicate}|${target}`
}

/** Noisy predicates that flood the graph if expanded. */
export const YAGO_SKIP_PREDICATES = new Set([
  'http://schema.org/url',
  'http://schema.org/image',
  'http://schema.org/sameAs',
  'http://schema.org/mainEntityOfPage',
  'http://schema.org/logo',
  'http://schema.org/alternateName',
  'http://yago-knowledge.org/resource/siteLinks',
])

export function isYagoSkipPredicate(uri: string): boolean {
  if (YAGO_SKIP_PREDICATES.has(uri)) return true
  if (uri.includes('/wiki/Special:FilePath')) return true
  return false
}

export async function yagoSearch(
  endpoint: string,
  term: string,
  classFilter?: string,
  limit = 12,
): Promise<ConnectedNode[]> {
  const q = term.trim()
  if (!q) return []
  const esc = q.replace(/\\/g, '\\\\').replace(/"/g, '\\"').toLowerCase()

  const typeClause = classFilter
    ? `
      ?s a ?cls .
      ?cls <http://www.w3.org/2000/01/rdf-schema#subClassOf>* <${classFilter}> .
    `
    : `FILTER(STRSTARTS(STR(?s), "http://yago-knowledge.org/resource/"))`

  // Prefer exact-ish label match, then contains
  const query = `
    SELECT DISTINCT ?s ?label WHERE {
      ?s <${RDFS_LABEL}> ?label .
      FILTER(LANG(?label) = "en" || LANG(?label) = "")
      FILTER(CONTAINS(LCASE(STR(?label)), "${esc}"))
      ${typeClause}
    }
    ORDER BY ASC(STRLEN(STR(?label)))
    LIMIT ${Math.min(limit, 20)}
  `

  try {
    const rows = await runSparql(endpoint, query, 16000)
    return rows.map((r) => ({
      uri: r.s.value,
      label: r.label?.value || localName(r.s.value),
    }))
  } catch {
    return []
  }
}

export async function yagoClassMap(endpoint: string): Promise<{
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
  for (const c of YAGO_CORE_CLASSES) {
    ensure(c.uri, c.label)
    ensure(c.parent, c.parent === OWL_THING ? 'Thing' : localName(c.parent))
    addSubclassEdge(c.uri, c.parent)
  }

  // Sample a few direct subclasses under Person / Place for richness
  const hubs = [
    'http://schema.org/Person',
    'http://schema.org/Place',
    'http://schema.org/Organization',
    'http://schema.org/CreativeWork',
  ]

  await Promise.all(
    hubs.map(async (hub) => {
      try {
        const query = `
          SELECT DISTINCT ?c ?label WHERE {
            ?c <${RDFS_SUBCLASS}> <${hub}> .
            OPTIONAL {
              ?c <${RDFS_LABEL}> ?label
              FILTER(LANG(?label) = "en" || LANG(?label) = "")
            }
          } LIMIT 4
        `
        const rows = await runSparql(endpoint, query, 10000)
        for (const r of rows) {
          const uri = r.c.value
          const label = r.label?.value || localName(uri)
          ensure(uri, label)
          addSubclassEdge(uri, hub)
        }
      } catch {
        /* curated backbone only */
      }
    }),
  )

  return {
    nodes: stampTreeHopDepths([...nodes.values()], links, OWL_THING),
    links,
    rootId: OWL_THING,
  }
}

export function yagoBindingLabel(r: SparqlBinding, varName = 'label'): string | undefined {
  return r[varName]?.value
}

/** Prefer schema.org / yago resource IRIs as expand targets. */
export function isYagoResourceUri(uri: string): boolean {
  return (
    uri.startsWith('http://yago-knowledge.org/resource/') ||
    uri.startsWith('http://schema.org/')
  )
}