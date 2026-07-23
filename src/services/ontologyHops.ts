import type {
  ConnectedNode,
  DataProperty,
  GraphLink,
  GraphNode,
  RelationType,
} from '../types/ontology'
import {
  fetchConnectedNodes,
  fetchDataProperties,
  fetchRelationTypes,
  fetchResourceClasses,
  fetchResourceLabel,
  isOntologyClassUri,
  localName,
  type HopDirection,
} from '../services/sparql'
import { isWikidataEndpoint } from '../services/sparql-core'
import * as wd from '../services/wikidata'

function linkId(source: string, predicate: string, target: string) {
  return `${source}|${predicate}|${target}`
}

export function relationHubId(
  subjectUri: string,
  predicate: string,
  direction: 'out' | 'in',
) {
  return `relhub:${direction}:${predicate}:${subjectUri}`
}

export function isRelationHubId(id: string) {
  return id.startsWith('relhub:')
}

function cleanPredLabel(label: string) {
  return label.replace(/\s*\(.*\)$/, '').trim() || label
}

/** Stable palette index from cluster key for matching hub ↔ value colours. */
export function clusterColorIndex(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % CLUSTER_PALETTE.length
}

/** Sholay-style category colours — hub fill solid, values white + same border. */
export const CLUSTER_PALETTE = [
  { fill: '#2f9e6b', border: '#2f9e6b', text: '#ffffff', valueFill: '#ffffff', valueText: '#1a3d2e' },
  { fill: '#c45b8c', border: '#c45b8c', text: '#ffffff', valueFill: '#ffffff', valueText: '#4a1f35' },
  { fill: '#d4782a', border: '#d4782a', text: '#ffffff', valueFill: '#ffffff', valueText: '#5c3010' },
  { fill: '#5b6bc7', border: '#5b6bc7', text: '#ffffff', valueFill: '#ffffff', valueText: '#1e2558' },
  { fill: '#8b5cb8', border: '#8b5cb8', text: '#ffffff', valueFill: '#ffffff', valueText: '#3a1f52' },
  { fill: '#2a9a9e', border: '#2a9a9e', text: '#ffffff', valueFill: '#ffffff', valueText: '#0d3d40' },
  { fill: '#b85c5c', border: '#b85c5c', text: '#ffffff', valueFill: '#ffffff', valueText: '#4a1f1f' },
  { fill: '#6b8f3a', border: '#6b8f3a', text: '#ffffff', valueFill: '#ffffff', valueText: '#2a3d14' },
] as const

function pickRelations(
  types: RelationType[],
  direction: HopDirection,
  limit: number,
): RelationType[] {
  const dirs =
    direction === 'both' ? (['out', 'in'] as const) : ([direction] as const)
  const out: RelationType[] = []
  for (const d of dirs) {
    const slice = types.filter((t) => t.direction === d).slice(0, Math.ceil(limit / dirs.length))
    out.push(...slice)
  }
  // de-dupe by predicate+direction
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.direction}:${r.predicate}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** Hop 1 — ontology relation / category hubs under a subject entity. */
export function buildRelationHubs(
  subjectUri: string,
  relations: RelationType[],
  direction: HopDirection,
  limit = 10,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const picked = pickRelations(relations, direction, limit)
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []

  for (const rel of picked) {
    const id = relationHubId(subjectUri, rel.predicate, rel.direction)
    const label = cleanPredLabel(rel.predicateLabel)
    nodes.push({
      id,
      uri: rel.predicate,
      label,
      type: 'relation',
      classes: [rel.direction === 'out' ? 'Outgoing property' : 'Incoming property'],
      __hopDepth: 1,
      __clusterKey: id,
      __parentId: subjectUri,
      __predicate: rel.predicate,
      __direction: rel.direction,
      __pulse: 1,
    })
    links.push({
      id: linkId(subjectUri, rel.predicate, id),
      source: subjectUri,
      target: id,
      predicate: rel.predicate,
      predicateLabel: label,
    })
  }

  return { nodes, links }
}

/** Data-property hubs (Language, Release year…) as ontology categories. */
export function buildDataPropertyHubs(
  subjectUri: string,
  dataProperties: DataProperty[],
  limit = 5,
): { nodes: GraphNode[]; links: GraphLink[]; valueNodes: GraphNode[]; valueLinks: GraphLink[] } {
  const skip = /description|abstract|comment|wiki/i
  const hubs: GraphNode[] = []
  const hubLinks: GraphLink[] = []
  const valueNodes: GraphNode[] = []
  const valueLinks: GraphLink[] = []
  let n = 0

  for (const p of dataProperties) {
    if (n >= limit) break
    if (skip.test(p.predicateLabel) || skip.test(p.predicate)) continue
    const value = p.value.trim()
    if (!value || value.length > 80) continue
    if (value.length > 48 && !/^\d/.test(value)) continue

    const hubId = relationHubId(subjectUri, p.predicate, 'out')
    if (hubs.some((h) => h.id === hubId)) continue

    const label = cleanPredLabel(p.predicateLabel)
    hubs.push({
      id: hubId,
      uri: p.predicate,
      label,
      type: 'relation',
      classes: ['Data property'],
      __hopDepth: 1,
      __clusterKey: hubId,
      __parentId: subjectUri,
      __predicate: p.predicate,
      __direction: 'out',
      __pulse: 1,
    })
    hubLinks.push({
      id: linkId(subjectUri, p.predicate, hubId),
      source: subjectUri,
      target: hubId,
      predicate: p.predicate,
      predicateLabel: label,
    })

    const litId = `literal:${p.predicate}:${value.slice(0, 64)}`
    valueNodes.push({
      id: litId,
      uri: litId,
      label: value.length > 28 ? `${value.slice(0, 26)}…` : value,
      type: 'literal',
      classes: [label],
      __hopDepth: 2,
      __clusterKey: hubId,
      __parentId: hubId,
      __predicate: p.predicate,
      __pulse: 1,
    })
    valueLinks.push({
      id: linkId(hubId, p.predicate, litId),
      source: hubId,
      target: litId,
      predicate: p.predicate,
      predicateLabel: label,
    })
    n += 1
  }

  return { nodes: hubs, links: hubLinks, valueNodes, valueLinks }
}

/** Hop 2 — values under relation hubs (ontology objects). */
export async function expandRelationHubValues(
  endpoint: string,
  hubs: GraphNode[],
  neighborsPerHub = 5,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const relHubs = hubs.filter((h) => h.type === 'relation' && h.__parentId && h.__predicate)

  await Promise.all(
    relHubs.map(async (hub) => {
      const subject = hub.__parentId!
      const predicate = hub.__predicate!
      const direction = hub.__direction ?? 'out'
      // Skip if this hub already got literal values via data props path
      try {
        const neighbors = await fetchConnectedNodes(
          endpoint,
          subject,
          predicate,
          direction,
          neighborsPerHub,
        )
        for (const n of neighbors) {
          if (nodes.some((x) => x.id === n.uri) || n.uri === subject) continue
          nodes.push({
            id: n.uri,
            uri: n.uri,
            label: n.label,
            type: isOntologyClassUri(n.uri) ? 'class' : 'resource',
            classes: n.typeLabel ? [n.typeLabel] : undefined,
            __hopDepth: 2,
            __clusterKey: hub.id,
            __parentId: hub.id,
            __predicate: predicate,
            __pulse: 1,
          })
          links.push({
            id: linkId(hub.id, predicate, n.uri),
            source: hub.id,
            target: n.uri,
            predicate,
            predicateLabel: hub.label,
          })
        }
      } catch {
        /* skip */
      }
    }),
  )

  return { nodes, links }
}

/**
 * One entity-distance hop from frontier entities.
 * Out  = follow outgoing properties only
 * In   = follow incoming only
 * Both = both directions
 * Each hop adds Property hubs + Value entities (ontology-shaped).
 */
export async function expandEntityHopLayer(
  endpoint: string,
  frontierEntityIds: string[],
  direction: HopDirection,
  depth: number,
  opts?: {
    maxSubjects?: number
    predsPerSubject?: number
    neighborsPerPred?: number
  },
): Promise<{ nodes: GraphNode[]; links: GraphLink[]; nextFrontier: string[]; exhausted: boolean }> {
  const maxSubjects = opts?.maxSubjects ?? 6
  const predsPerSubject = opts?.predsPerSubject ?? (direction === 'both' ? 3 : 4)
  const neighborsPerPred = opts?.neighborsPerPred ?? 4

  const subjects = frontierEntityIds
    .filter((id) => !isRelationHubId(id) && !id.startsWith('literal:'))
    .slice(0, maxSubjects)

  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const nextFrontier: string[] = []
  const seen = new Set<string>()

  await Promise.all(
    subjects.map(async (subjectUri) => {
      try {
        const types = await fetchRelationTypes(endpoint, subjectUri)
        const hubs = buildRelationHubs(subjectUri, types, direction, predsPerSubject)
        const stampedHubs = hubs.nodes.map((h) => ({ ...h, __hopDepth: depth }))
        for (const h of stampedHubs) {
          if (seen.has(h.id)) continue
          seen.add(h.id)
          nodes.push(h)
        }
        for (const l of hubs.links) {
          if (seen.has(l.id)) continue
          seen.add(l.id)
          links.push(l)
        }

        const vals = await expandRelationHubValues(endpoint, stampedHubs, neighborsPerPred)
        for (const v of vals.nodes) {
          if (seen.has(v.id)) continue
          seen.add(v.id)
          nodes.push({ ...v, __hopDepth: depth })
          if (v.type === 'resource' || v.type === 'class') nextFrontier.push(v.id)
        }
        for (const l of vals.links) {
          if (seen.has(l.id)) continue
          seen.add(l.id)
          links.push(l)
        }
      } catch {
        /* skip subject */
      }
    }),
  )

  return {
    nodes,
    links,
    nextFrontier: [...new Set(nextFrontier)],
    exhausted: nextFrontier.length === 0 && nodes.filter((n) => n.type !== 'relation').length === 0,
  }
}

/** Attach neighbors under a property hub (Entity → Property → Values). */
export function graphPiecesViaHub(
  subjectUri: string,
  relation: RelationType,
  items: ConnectedNode[],
  hopDepth = 1,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const hubId = relationHubId(subjectUri, relation.predicate, relation.direction)
  const label = cleanPredLabel(relation.predicateLabel)
  const hub: GraphNode = {
    id: hubId,
    uri: relation.predicate,
    label,
    type: 'relation',
    classes: [relation.direction === 'out' ? 'Outgoing property' : 'Incoming property'],
    __hopDepth: hopDepth,
    __clusterKey: hubId,
    __parentId: subjectUri,
    __predicate: relation.predicate,
    __direction: relation.direction,
    __pulse: 1,
  }
  const valueNodes: GraphNode[] = items.map((n) => ({
    id: n.uri,
    uri: n.uri,
    label: n.label,
    type: isOntologyClassUri(n.uri) ? ('class' as const) : ('resource' as const),
    classes: n.typeLabel ? [n.typeLabel] : undefined,
    __hopDepth: hopDepth,
    __clusterKey: hubId,
    __parentId: hubId,
    __predicate: relation.predicate,
    __pulse: 1,
  }))
  const links: GraphLink[] = [
    {
      id: linkId(subjectUri, relation.predicate, hubId),
      source: subjectUri,
      target: hubId,
      predicate: relation.predicate,
      predicateLabel: label,
    },
    ...items.map((n) => ({
      id: linkId(hubId, relation.predicate, n.uri),
      source: hubId,
      target: n.uri,
      predicate: relation.predicate,
      predicateLabel: label,
    })),
  ]
  return { nodes: [hub, ...valueNodes], links }
}

/** Max entity-distance hops from the seed (stop earlier when SPARQL has no more data). */
export const MAX_ONTOLOGY_HOPS = 5

export interface OntologyKnowledgeGraph {
  label: string
  classes: string[]
  dataProperties: DataProperty[]
  relationTypes: RelationType[]
  nodes: GraphNode[]
  links: GraphLink[]
  message: string
  /** Entity-distance hop depth (1 = seed’s properties + values). */
  appliedHopDepth: number
}

/**
 * Seed → one entity hop: property hubs + values (depth 1).
 * Further hops grow from those values via expandEntityHopLayer.
 */
export async function fetchOntologyKnowledgeGraph(
  endpoint: string,
  uri: string,
  direction: HopDirection = 'out',
): Promise<OntologyKnowledgeGraph> {
  let label: string
  let classes: string[]
  let dataProperties: DataProperty[]
  let relationTypes: RelationType[]

  if (isWikidataEndpoint(endpoint)) {
    ;[label, classes, dataProperties, relationTypes] = await Promise.all([
      wd.wdLabel(endpoint, uri),
      fetchResourceClasses(endpoint, uri),
      fetchDataProperties(endpoint, uri),
      fetchRelationTypes(endpoint, uri),
    ])
  } else {
    ;[label, classes, dataProperties, relationTypes] = await Promise.all([
      fetchResourceLabel(endpoint, uri),
      fetchResourceClasses(endpoint, uri),
      fetchDataProperties(endpoint, uri),
      fetchRelationTypes(endpoint, uri),
    ])
  }

  const center: GraphNode = {
    id: uri,
    uri,
    label: label || localName(uri),
    type: isOntologyClassUri(uri) ? 'class' : 'resource',
    classes,
    dataProperties,
    __hopDepth: 0,
    __pulse: 1,
  }

  const hubLimit = direction === 'both' ? 12 : 10
  const objectHubs = buildRelationHubs(uri, relationTypes, direction, hubLimit)
  const dataHubs = buildDataPropertyHubs(uri, dataProperties, 5)

  // Avoid duplicate hub ids between object + data props
  const hubNodes = [...objectHubs.nodes]
  const hubLinks = [...objectHubs.links]
  for (const h of dataHubs.nodes) {
    if (!hubNodes.some((x) => x.id === h.id)) hubNodes.push(h)
  }
  for (const l of dataHubs.links) {
    if (!hubLinks.some((x) => x.id === l.id)) hubLinks.push(l)
  }

  const objectValues = await expandRelationHubValues(
    endpoint,
    objectHubs.nodes,
    direction === 'both' ? 4 : 5,
  )

  const nodeMap = new Map<string, GraphNode>([[uri, center]])
  const linkMap = new Map<string, GraphLink>()

  for (const n of [...hubNodes, ...dataHubs.valueNodes, ...objectValues.nodes]) {
    if (!nodeMap.has(n.id)) nodeMap.set(n.id, n)
  }
  for (const l of [...hubLinks, ...dataHubs.valueLinks, ...objectValues.links]) {
    if (!linkMap.has(l.id)) linkMap.set(l.id, l)
  }

  const nodes = [...nodeMap.values()].map((n) =>
    n.id === uri ? n : { ...n, __hopDepth: 1 },
  )
  const links = [...linkMap.values()]
  const hubCount = nodes.filter((n) => n.type === 'relation').length
  const valueCount = nodes.filter((n) => n.type !== 'relation' && n.id !== uri).length

  return {
    label: center.label,
    classes,
    dataProperties,
    relationTypes,
    nodes,
    links,
    appliedHopDepth: 1,
    message: `Ontology graph · ${hubCount} properties · ${valueCount} values (Entity → Property → Value)`,
  }
}
