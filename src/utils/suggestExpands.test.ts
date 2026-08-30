import { describe, expect, it } from 'vitest'
import { suggestExpands } from './suggestExpands'
import type { GraphData } from '../types/ontology'

const emptyGraph: GraphData = { nodes: [], links: [] }

describe('suggestExpands', () => {
  it('suggests unexpanded facets for person', () => {
    const actions = suggestExpands('person', ['identity'], [], emptyGraph, 3)
    expect(actions.some((a) => a.type === 'facet' && a.id === 'family')).toBe(true)
  })

  it('suggests relations when facets exhausted', () => {
    const actions = suggestExpands(
      'other',
      [],
      [
        {
          predicate: 'p1',
          predicateLabel: 'cast member',
          count: 12,
          direction: 'in',
        },
      ],
      emptyGraph,
      2,
    )
    expect(actions[0]?.type).toBe('relation')
  })
})
