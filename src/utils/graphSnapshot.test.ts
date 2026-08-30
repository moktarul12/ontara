import { describe, expect, it } from 'vitest'
import { restoreGraphFromSnapshot, serializeGraphSnapshot } from './graphSnapshot'
import type { GraphData } from '../types/ontology'

const graph: GraphData = {
  nodes: [
    {
      id: 'http://www.wikidata.org/entity/Q9570',
      label: 'Amitabh Bachchan',
      uri: 'http://www.wikidata.org/entity/Q9570',
      type: 'resource',
      x: 10,
      y: 20,
    },
  ],
  links: [],
}

describe('graphSnapshot', () => {
  it('round-trips serialize and restore', () => {
    const snap = serializeGraphSnapshot({
      source: 'wikidata',
      seedUri: 'http://www.wikidata.org/entity/Q9570',
      seedLabel: 'Amitabh Bachchan',
      entityKind: 'person',
      appliedHopDepth: 1,
      expandedFacets: ['family'],
      selectedNodeId: 'http://www.wikidata.org/entity/Q9570',
      graph,
    })
    const restored = restoreGraphFromSnapshot(snap)
    expect(restored.seedLabel).toBe('Amitabh Bachchan')
    expect(restored.graph.nodes[0].x).toBeUndefined()
    expect(restored.expandedFacets).toEqual(['family'])
  })
})
