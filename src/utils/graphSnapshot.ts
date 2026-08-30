import type { GraphData, GraphLink, GraphNode, SparqlSourceId } from '../types/ontology'
import type { EntityKind } from '../services/ontologyHops'
import type { FacetId } from '../types/facets'

export const SNAPSHOT_VERSION = 1 as const

export interface GraphSnapshot {
  v: typeof SNAPSHOT_VERSION
  source: SparqlSourceId
  seedUri: string
  seedLabel: string
  entityKind: EntityKind
  appliedHopDepth: number
  expandedFacets: FacetId[]
  selectedNodeId: string | null
  nodes: GraphNode[]
  links: GraphLink[]
  savedAt: string
}

function stripLayoutNode(n: GraphNode): GraphNode {
  const { x, y, vx, vy, fx, fy, ...rest } = n
  void x
  void y
  void vx
  void vy
  void fx
  void fy
  return { ...rest }
}

function normalizeLink(l: GraphLink): GraphLink {
  const source = typeof l.source === 'string' ? l.source : l.source.id
  const target = typeof l.target === 'string' ? l.target : l.target.id
  return { ...l, source, target }
}

export function serializeGraphSnapshot(input: {
  source: SparqlSourceId
  seedUri: string
  seedLabel: string
  entityKind: EntityKind
  appliedHopDepth: number
  expandedFacets: FacetId[]
  selectedNodeId: string | null
  graph: GraphData
}): GraphSnapshot {
  return {
    v: SNAPSHOT_VERSION,
    source: input.source,
    seedUri: input.seedUri,
    seedLabel: input.seedLabel,
    entityKind: input.entityKind,
    appliedHopDepth: input.appliedHopDepth,
    expandedFacets: [...input.expandedFacets],
    selectedNodeId: input.selectedNodeId,
    nodes: input.graph.nodes.map(stripLayoutNode),
    links: input.graph.links.map(normalizeLink),
    savedAt: new Date().toISOString(),
  }
}

export function restoreGraphFromSnapshot(
  snap: GraphSnapshot,
): {
  graph: GraphData
  seedUri: string
  seedLabel: string
  source: SparqlSourceId
  entityKind: EntityKind
  appliedHopDepth: number
  expandedFacets: FacetId[]
  selectedNodeId: string | null
} {
  if (snap.v !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version ${snap.v}`)
  }
  return {
    graph: {
      nodes: snap.nodes.map((n) => ({ ...n })),
      links: snap.links.map(normalizeLink),
    },
    seedUri: snap.seedUri,
    seedLabel: snap.seedLabel,
    source: snap.source,
    entityKind: snap.entityKind,
    appliedHopDepth: snap.appliedHopDepth,
    expandedFacets: [...snap.expandedFacets],
    selectedNodeId: snap.selectedNodeId,
  }
}
