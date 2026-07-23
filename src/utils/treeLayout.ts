import type { GraphData, GraphLink, GraphNode } from '../types/ontology'

/** BFS hop depths from root for class-map / tree graphs. */
export function stampTreeHopDepths(
  nodes: GraphNode[],
  links: GraphLink[],
  rootId: string,
): GraphNode[] {
  const children = new Map<string, string[]>()
  for (const l of links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id
    const t = typeof l.target === 'string' ? l.target : l.target.id
    // subclass edges: child → parent, so parent is target; walk parent → children
    const list = children.get(t) ?? []
    list.push(s)
    children.set(t, list)
  }

  const depth = new Map<string, number>()
  const q: string[] = [rootId]
  depth.set(rootId, 0)
  while (q.length) {
    const id = q.shift()!
    const d = depth.get(id) ?? 0
    for (const child of children.get(id) ?? []) {
      if (depth.has(child)) continue
      depth.set(child, Math.min(3, d + 1))
      q.push(child)
    }
  }

  return nodes.map((n) => ({
    ...n,
    __hopDepth: depth.get(n.id) ?? (n.id === rootId ? 0 : 1),
  }))
}

export function graphHasOntologyHubs(data: GraphData): boolean {
  return data.nodes.some((n) => n.type === 'relation')
}
