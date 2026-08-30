import { describe, expect, it } from 'vitest'
import { findShortestPath } from './graphPath'
import type { GraphData } from '../types/ontology'

const mockGraph: GraphData = {
  nodes: [
    { id: 'a', label: 'A', uri: 'a', type: 'resource' },
    { id: 'b', label: 'B', uri: 'b', type: 'resource' },
    { id: 'c', label: 'C', uri: 'c', type: 'resource' },
    { id: 'd', label: 'D', uri: 'd', type: 'resource' },
  ],
  links: [
    {
      id: 'l1',
      source: 'a',
      target: 'b',
      predicate: 'p1',
      predicateLabel: 'knows',
    },
    {
      id: 'l2',
      source: 'b',
      target: 'c',
      predicate: 'p2',
      predicateLabel: 'works with',
    },
  ],
}

describe('findShortestPath', () => {
  it('finds path between connected nodes', () => {
    const path = findShortestPath(mockGraph, 'a', 'c')
    expect(path).not.toBeNull()
    expect(path!.steps.map((s) => s.nodeId)).toEqual(['a', 'b', 'c'])
    expect(path!.linkIds).toEqual(['l1', 'l2'])
  })

  it('returns null when disconnected', () => {
    expect(findShortestPath(mockGraph, 'a', 'd')).toBeNull()
  })

  it('handles same node', () => {
    const path = findShortestPath(mockGraph, 'a', 'a')
    expect(path?.steps).toHaveLength(1)
  })
})
