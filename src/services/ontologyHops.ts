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

function hashLit(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function clusterColorIndex(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return h % CLUSTER_PALETTE.length
}

/** Property-cluster colours — hub solid; values share the border. */
export const CLUSTER_PALETTE = [
  { fill: '#1f6b52', border: '#3ddc97', text: '#ffffff', valueFill: '#f4fbf8', valueText: '#0d3d32' },
  { fill: '#8a3d5c', border: '#e07a9e', text: '#ffffff', valueFill: '#fdf6f9', valueText: '#4a1f35' },
  { fill: '#a65c20', border: '#e8a05a', text: '#ffffff', valueFill: '#fff8f0', valueText: '#5c3010' },
  { fill: '#2f4f7a', border: '#7eb0d4', text: '#ffffff', valueFill: '#f4f8fc', valueText: '#1e2558' },
  { fill: '#5c3d7a', border: '#b48ad4', text: '#ffffff', valueFill: '#f8f4fc', valueText: '#3a1f52' },
  { fill: '#1f6a6e', border: '#4ec4c8', text: '#ffffff', valueFill: '#f2fafb', valueText: '#0d3d40' },
  { fill: '#7a3d3d', border: '#d48a8a', text: '#ffffff', valueFill: '#fdf6f6', valueText: '#4a1f1f' },
  { fill: '#4a5c28', border: '#9ab85a', text: '#ffffff', valueFill: '#f6faf0', valueText: '#2a3d14' },
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
  const seen = new Set<string>()
  return out.filter((r) => {
    const k = `${r.direction}:${r.predicate}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * Property hub chips under a subject.
 * `__hopDepth` = entity-distance of the values hanging off this hub (hubs do not add hop).
 * Edge labels left empty — the hub chip carries the predicate name.
 */
export function buildRelationHubs(
  subjectUri: string,
  relations: RelationType[],
  direction: HopDirection,
  limit = 6,
  entityHop = 1,
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
      classes: [rel.direction === 'out' ? 'Outgoing' : 'Incoming'],
      __hopDepth: entityHop,
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
      predicateLabel: '', // silent — hub shows the name
    })
  }

  return { nodes, links }
}

/** Short literal facts as hub + value (subject-scoped literal ids). */
export function buildDataPropertyHubs(
  subjectUri: string,
  dataProperties: DataProperty[],
  limit = 3,
  entityHop = 1,
): { nodes: GraphNode[]; links: GraphLink[]; valueNodes: GraphNode[]; valueLinks: GraphLink[] } {
  const skip = /description|abstract|comment|wiki|image/i
  const hubs: GraphNode[] = []
  const hubLinks: GraphLink[] = []
  const valueNodes: GraphNode[] = []
  const valueLinks: GraphLink[] = []
  let n = 0

  for (const p of dataProperties) {
    if (n >= limit) break
    if (skip.test(p.predicateLabel) || skip.test(p.predicate)) continue
    const value = p.value.trim()
    if (!value || value.length > 48) continue

    const hubId = relationHubId(subjectUri, p.predicate, 'out')
    if (hubs.some((h) => h.id === hubId)) continue

    const label = cleanPredLabel(p.predicateLabel)
    hubs.push({
      id: hubId,
      uri: p.predicate,
      label,
      type: 'relation',
      classes: ['Data'],
      __hopDepth: entityHop,
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
      predicateLabel: '',
    })

    const litId = `literal:${subjectUri}:${p.predicate}:${hashLit(value)}`
    valueNodes.push({
      id: litId,
      uri: litId,
      label: value.length > 26 ? `${value.slice(0, 24)}…` : value,
      type: 'literal',
      classes: [label],
      __hopDepth: entityHop,
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
      predicateLabel: '',
    })
    n += 1
  }

  return { nodes: hubs, links: hubLinks, valueNodes, valueLinks }
}

/** Values under relation hubs — stamped with the hub’s entity hop. */
export async function expandRelationHubValues(
  endpoint: string,
  hubs: GraphNode[],
  neighborsPerHub = 3,
): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const seenPair = new Set<string>()
  const relHubs = hubs.filter((h) => h.type === 'relation' && h.__parentId && h.__predicate)

  await Promise.all(
    relHubs.map(async (hub) => {
      const subject = hub.__parentId!
      const predicate = hub.__predicate!
      const direction = hub.__direction ?? 'out'
      const hop = hub.__hopDepth ?? 1
      try {
        const neighbors = await fetchConnectedNodes(
          endpoint,
          subject,
          predicate,
          direction,
          neighborsPerHub,
        )
        for (const n of neighbors) {
          if (n.uri === subject) continue
          const pair = `${hub.id}|${n.uri}`
          if (seenPair.has(pair)) continue
          seenPair.add(pair)
          // One global node per URI; first hub wins parent for layout
          if (!nodes.some((x) => x.id === n.uri)) {
            nodes.push({
              id: n.uri,
              uri: n.uri,
              label: n.label,
              type: isOntologyClassUri(n.uri) ? 'class' : 'resource',
              classes: n.typeLabel ? [n.typeLabel] : undefined,
              __hopDepth: hop,
              __clusterKey: hub.id,
              __parentId: hub.id,
              __predicate: predicate,
              __pulse: 1,
            })
          }
          links.push({
            id: linkId(hub.id, predicate, n.uri),
            source: hub.id,
            target: n.uri,
            predicate,
            predicateLabel: '',
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
 * Hub chips do not increment hop — only entity/literal values sit at `depth`.
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
  const maxSubjects = opts?.maxSubjects ?? 5
  const predsPerSubject = opts?.predsPerSubject ?? (direction === 'both' ? 3 : 4)
  const neighborsPerPred = opts?.neighborsPerPred ?? 3

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
        const hubs = buildRelationHubs(
          subjectUri,
          types,
          direction,
          predsPerSubject,
          depth,
        )
        for (const h of hubs.nodes) {
          if (seen.has(h.id)) continue
          seen.add(h.id)
          nodes.push(h)
        }
        for (const l of hubs.links) {
          if (seen.has(l.id)) continue
          seen.add(l.id)
          links.push(l)
        }

        const vals = await expandRelationHubValues(endpoint, hubs.nodes, neighborsPerPred)
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

/** Attach neighbors under a property hub (Entity → Property chip → Values). */
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
    classes: [relation.direction === 'out' ? 'Outgoing' : 'Incoming'],
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
      predicateLabel: '',
    },
    ...items.map((n) => ({
      id: linkId(hubId, relation.predicate, n.uri),
      source: hubId,
      target: n.uri,
      predicate: relation.predicate,
      predicateLabel: '',
    })),
  ]
  return { nodes: [hub, ...valueNodes], links }
}

export const MAX_ONTOLOGY_HOPS = 5

/** Sparse seed defaults — readable first paint. */
export const SEED_PRED_LIMIT = 6
export const SEED_VALUES_PER_PRED = 3
export const SEED_DATA_LIMIT = 3

export interface OntologyKnowledgeGraph {
  label: string
  classes: string[]
  dataProperties: DataProperty[]
  relationTypes: RelationType[]
  nodes: GraphNode[]
  links: GraphLink[]
  message: string
  appliedHopDepth: number
}

/**
 * Sparse seed graph: entity + top properties + a few values each.
 * Hop 0 = seed · Hop 1 = direct neighbors (hubs are chips, not an extra hop).
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

  const objectHubs = buildRelationHubs(
    uri,
    relationTypes,
    direction,
    SEED_PRED_LIMIT,
    1,
  )
  const dataHubs = buildDataPropertyHubs(uri, dataProperties, SEED_DATA_LIMIT, 1)

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
    SEED_VALUES_PER_PRED,
  )

  const nodeMap = new Map<string, GraphNode>([[uri, center]])
  const linkMap = new Map<string, GraphLink>()

  for (const n of [...hubNodes, ...dataHubs.valueNodes, ...objectValues.nodes]) {
    if (!nodeMap.has(n.id)) nodeMap.set(n.id, n)
  }
  for (const l of [...hubLinks, ...dataHubs.valueLinks, ...objectValues.links]) {
    if (!linkMap.has(l.id)) linkMap.set(l.id, l)
  }

  // Keep stamped hops: seed 0, hubs+values at entity hop 1 (no flatten overwrite)
  const nodes = [...nodeMap.values()]
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
    message: `Started sparse · ${hubCount} properties · ${valueCount} values · expand to grow`,
  }
}
