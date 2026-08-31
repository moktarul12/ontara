import { describe, expect, it } from 'vitest'
import type { GraphData } from '../types/ontology'
import { buildKinMaps, buildPedigreeEdges } from './familyTreeGraph'

describe('familyTreeGraph', () => {
  it('derives labeled person edges from kinship hubs', () => {
    const seed = 'http://www.wikidata.org/entity/Q1'
    const father = 'http://www.wikidata.org/entity/Q2'
    const child = 'http://www.wikidata.org/entity/Q3'
    const hubParents = `relhub:out:parents:${seed}`
    const hubChild = `relhub:out:child:${seed}`

    const data: GraphData = {
      nodes: [
        { id: seed, uri: seed, label: 'Seed', type: 'resource', __familyGen: 0, __familyRole: 'seed' },
        { id: father, uri: father, label: 'Father', type: 'resource', __familyGen: -1, __familyRole: 'parent' },
        { id: child, uri: child, label: 'Child', type: 'resource', __familyGen: 1, __familyRole: 'child' },
        {
          id: hubParents,
          uri: hubParents,
          label: 'father',
          type: 'relation',
          classes: ['Kinship'],
          __parentId: seed,
        },
        {
          id: hubChild,
          uri: hubChild,
          label: 'child',
          type: 'relation',
          classes: ['Kinship'],
          __parentId: seed,
        },
      ],
      links: [
        { id: 'l1', source: seed, target: hubParents, predicate: 'p', predicateLabel: '' },
        { id: 'l2', source: hubParents, target: father, predicate: 'p', predicateLabel: '' },
        { id: 'l3', source: seed, target: hubChild, predicate: 'p', predicateLabel: '' },
        { id: 'l4', source: hubChild, target: child, predicate: 'p', predicateLabel: '' },
      ],
    }

    const maps = buildKinMaps(data)
    const edges = buildPedigreeEdges(data, maps)
    expect(edges.some((e) => e.relation === 'father' && e.source === father && e.target === seed)).toBe(
      true,
    )
    expect(edges.some((e) => e.relation === 'child' && e.source === seed && e.target === child)).toBe(
      true,
    )
    expect(maps.people).toHaveLength(3)
  })
})
