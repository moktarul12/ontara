import { describe, expect, it } from 'vitest'
import { classifyKindFromP31, inferKindFromFacts } from './entityKind'

describe('entityKind', () => {
  it('classifies films from P31', () => {
    expect(classifyKindFromP31(['Q11424'])).toBe('work')
  })

  it('infers work from director + film description', () => {
    expect(
      inferKindFromFacts(
        [{ predicate: '', predicateLabel: 'director', value: 'Ramesh Sippy', source: 'wikidata', group: 'career' }],
        '1975 Indian Hindi-language action-adventure film',
      ),
    ).toBe('work')
  })
})
