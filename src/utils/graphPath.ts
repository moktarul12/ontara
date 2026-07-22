import type { GraphData, GraphLink, GraphNode } from '../types/ontology'

export interface PathStep {
  nodeId: string
  label: string
  predicateLabel?: string
}

function endpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id
}

/** Shortest path on the local canvas graph (concept: multi-hop breadcrumb). */
export function findShortestPath(
  graph: GraphData,
  fromId: string,
  toId: string,
): { steps: PathStep[]; linkIds: string[] } | null {
  if (!fromId || !toId || fromId === toId) {
    const n = graph.nodes.find((x) => x.id === fromId)
    return n
      ? { steps: [{ nodeId: n.id, label: n.label }], linkIds: [] }
      : null
  }

  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]))
  const adj = new Map<string, { other: string; link: GraphLink }[]>()
  for (const l of graph.links) {
    const s = endpointId(l.source as string | GraphNode)
    const t = endpointId(l.target as string | GraphNode)
    if (!adj.has(s)) adj.set(s, [])
    if (!adj.has(t)) adj.set(t, [])
    adj.get(s)!.push({ other: t, link: l })
    adj.get(t)!.push({ other: s, link: l })
  }

  const prev = new Map<string, { from: string; link: GraphLink }>()
  const q = [fromId]
  const seen = new Set([fromId])
  let found = false

  while (q.length) {
    const cur = q.shift()!
    if (cur === toId) {
      found = true
      break
    }
    for (const edge of adj.get(cur) ?? []) {
      if (seen.has(edge.other)) continue
      seen.add(edge.other)
      prev.set(edge.other, { from: cur, link: edge.link })
      q.push(edge.other)
    }
  }

  if (!found) return null

  const steps: PathStep[] = []
  const linkIds: string[] = []
  let walk = toId
  const chain: { id: string; link?: GraphLink }[] = [{ id: toId }]
  while (walk !== fromId) {
    const p = prev.get(walk)
    if (!p) break
    chain.push({ id: p.from, link: p.link })
    walk = p.from
  }
  chain.reverse()

  for (let i = 0; i < chain.length; i++) {
    const id = chain[i].id
    const link = chain[i].link
    if (link) linkIds.push(link.id)
    steps.push({
      nodeId: id,
      label: labelOf.get(id) || id.split('/').pop() || id,
      predicateLabel: link?.predicateLabel,
    })
  }

  return { steps, linkIds }
}

export interface HopTrailStep {
  depth: number
  fromIds: string[]
  addedCount: number
  edgeCount: number
  sampleLabels: string[]
}
