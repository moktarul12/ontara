import { describe, expect, it } from 'vitest'
import { verifyProfileFacts } from './factVerifier'
import type { EntityProfile } from './entityProfile'

const baseProfile = (facts: EntityProfile['facts']): EntityProfile => ({
  uri: 'http://www.wikidata.org/entity/Q1',
  label: 'Test',
  kind: 'work',
  classes: [],
  facts,
  factsByGroup: {
    identity: [],
    life: [],
    career: facts,
    family: [],
    awards: [],
    links: [],
    other: [],
  },
  sourcesUsed: ['wikidata'],
  sourceUris: {},
})

describe('verifyProfileFacts', () => {
  it('marks facts confirmed when value appears in Wikipedia text', () => {
    const profile = baseProfile([
      {
        predicate: 'p',
        predicateLabel: 'director',
        value: 'Ramesh Srivastava',
        source: 'wikidata',
        group: 'career',
      },
      {
        predicate: 'p',
        predicateLabel: 'genre',
        value: 'action film',
        source: 'wikidata',
        group: 'career',
      },
    ])
    const wiki =
      'Sholay is a 1975 Indian action film directed by Ramesh Srivastava starring Amitabh Bachchan.'

    const { facts, trust } = verifyProfileFacts(profile, wiki)
    expect(facts.find((f) => f.label === 'director')?.status).toBe('confirmed')
    expect(facts.find((f) => f.label === 'director')?.sources).toContain('wikipedia')
    expect(trust.confirmedCount).toBeGreaterThan(0)
  })

  it('marks single-source facts as reported', () => {
    const profile = baseProfile([
      {
        predicate: 'p',
        predicateLabel: 'composer',
        value: 'Unknown Composer',
        source: 'wikidata',
        group: 'career',
      },
    ])
    const { facts } = verifyProfileFacts(profile, 'Unrelated article text.')
    expect(facts[0]?.status).toBe('reported')
    expect(facts[0]?.sources).toEqual(['wikidata'])
  })
})
