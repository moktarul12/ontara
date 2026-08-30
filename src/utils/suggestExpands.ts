import type { GraphData, RelationType } from '../types/ontology'
import { facetsForKind, type FacetId } from '../types/facets'
import type { EntityKind } from '../services/ontologyHops'

export type SuggestAction =
  | { type: 'facet'; id: FacetId; label: string; hint: string }
  | { type: 'relation'; relation: RelationType; label: string }

function hubOnGraph(graph: GraphData, predicate: string, direction: 'out' | 'in'): boolean {
  return graph.nodes.some(
    (n) =>
      n.type === 'relation' &&
      n.__predicate === predicate &&
      n.__direction === direction,
  )
}

/** Rank up to 5 suggested expand actions for the focus entity. */
export function suggestExpands(
  entityKind: EntityKind,
  expandedFacets: FacetId[],
  relationTypes: RelationType[],
  graph: GraphData,
  limit = 5,
): SuggestAction[] {
  const out: SuggestAction[] = []

  for (const f of facetsForKind(entityKind)) {
    if (expandedFacets.includes(f.id)) continue
    out.push({ type: 'facet', id: f.id, label: f.label, hint: f.hint })
    if (out.length >= limit) return out
  }

  const rels = [...relationTypes].sort((a, b) => b.count - a.count)
  for (const r of rels) {
    if (hubOnGraph(graph, r.predicate, r.direction)) continue
    out.push({
      type: 'relation',
      relation: r,
      label: `${r.direction === 'out' ? '→' : '←'} ${r.predicateLabel}`,
    })
    if (out.length >= limit) return out
  }

  return out
}
