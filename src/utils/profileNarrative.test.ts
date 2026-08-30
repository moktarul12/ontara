import { describe, expect, it } from 'vitest'
import { buildGroupNarrative, groupFactsByPredicate, joinPhrase } from './profileNarrative'
import type { ProfileFact } from '../services/entityProfile'

const fact = (label: string, value: string): ProfileFact => ({
  predicate: 'p',
  predicateLabel: label,
  value,
  source: 'wikidata',
  group: 'identity',
})

describe('joinPhrase', () => {
  it('joins lists naturally', () => {
    expect(joinPhrase(['A'])).toBe('A')
    expect(joinPhrase(['A', 'B'])).toBe('A and B')
    expect(joinPhrase(['A', 'B', 'C'])).toBe('A, B, and C')
  })
})

describe('buildGroupNarrative', () => {
  it('writes identity paragraph', () => {
    const text = buildGroupNarrative(
      'identity',
      [
        fact('instance of', 'human'),
        fact('country of citizenship', 'India'),
        fact('languages spoken', 'Hindi'),
      ],
      'Shah Rukh Khan',
    )
    expect(text).toContain('Shah Rukh Khan')
    expect(text).toContain('India')
    expect(text).toContain('Hindi')
  })

  it('writes career paragraph', () => {
    const text = buildGroupNarrative(
      'career',
      [fact('occupation', 'film actor'), fact('notable work', 'Dilwale Dulhania Le Jayenge')],
      'Shah Rukh Khan',
    )
    expect(text).toContain('film actor')
    expect(text).toContain('Dilwale')
  })
})

describe('groupFactsByPredicate', () => {
  it('merges values under same predicate', () => {
    const grouped = groupFactsByPredicate([
      fact('occupation', 'actor'),
      fact('occupation', 'producer'),
      fact('spouse', 'Gauri Khan'),
    ])
    expect(grouped).toHaveLength(2)
    expect(grouped.find((g) => g.predicateLabel === 'occupation')?.values).toHaveLength(2)
  })
})
