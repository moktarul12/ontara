import { describe, expect, it } from 'vitest'
import { categoryFromSignals } from '../services/compareCategory'

describe('categoryFromSignals', () => {
  it('prefers occupation for people', () => {
    const cat = categoryFromSignals({
      occupations: [{ uri: 'http://www.wikidata.org/entity/Q33999', label: 'film actor' }],
      industries: [],
      instances: [{ uri: 'http://www.wikidata.org/entity/Q5', label: 'human' }],
    })
    expect(cat?.kind).toBe('person')
    expect(cat?.label).toBe('film actor')
    expect(cat?.matchProp).toBe('occupation')
  })

  it('uses industry for retailers like Lowe’s peers', () => {
    const cat = categoryFromSignals({
      occupations: [],
      industries: [{ uri: 'http://www.wikidata.org/entity/Q126793', label: 'retail' }],
      instances: [{ uri: 'http://www.wikidata.org/entity/Q783794', label: 'public company' }],
    })
    expect(cat?.kind).toBe('org')
    expect(cat?.label).toBe('retail companies')
    expect(cat?.matchProp).toBe('industry')
  })

  it('falls back to instance for films', () => {
    const cat = categoryFromSignals({
      occupations: [],
      industries: [],
      instances: [{ uri: 'http://www.wikidata.org/entity/Q11424', label: 'film' }],
    })
    expect(cat?.kind).toBe('work')
    expect(cat?.matchProp).toBe('instance')
  })
})
