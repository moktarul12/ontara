import { describe, expect, it } from 'vitest'
import { groupProfileFacts, mergeProfileFacts, type ProfileFact } from './entityProfile'

const fact = (partial: Partial<ProfileFact> & Pick<ProfileFact, 'predicateLabel' | 'value'>): ProfileFact => ({
  predicate: 'p',
  source: 'wikidata',
  group: 'other',
  ...partial,
})

describe('mergeProfileFacts', () => {
  it('dedupes same fact from multiple sources preferring wikidata', () => {
    const merged = mergeProfileFacts([
      fact({ predicateLabel: 'occupation', value: 'film actor', source: 'dbpedia' }),
      fact({ predicateLabel: 'occupation', value: 'film actor', source: 'wikidata' }),
    ])
    expect(merged).toHaveLength(1)
    expect(merged[0].source).toBe('wikidata')
  })

  it('keeps distinct facts', () => {
    const merged = mergeProfileFacts([
      fact({ predicateLabel: 'spouse', value: 'A', source: 'wikidata', group: 'family' }),
      fact({ predicateLabel: 'child', value: 'B', source: 'dbpedia', group: 'family' }),
    ])
    expect(merged).toHaveLength(2)
  })
})

describe('groupProfileFacts', () => {
  it('groups by section', () => {
    const grouped = groupProfileFacts([
      fact({ predicateLabel: 'occupation', value: 'actor', group: 'career' }),
      fact({ predicateLabel: 'spouse', value: 'X', group: 'family' }),
    ])
    expect(grouped.career).toHaveLength(1)
    expect(grouped.family).toHaveLength(1)
  })
})
