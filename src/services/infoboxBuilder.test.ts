import { describe, expect, it } from 'vitest'
import { buildInfobox } from '../services/infoboxBuilder'
import type { EntityProfile } from '../services/entityProfile'

const baseProfile = (overrides: Partial<EntityProfile> = {}): EntityProfile => ({
  uri: 'http://www.wikidata.org/entity/Q1',
  label: 'Test Person',
  kind: 'person',
  classes: ['human'],
  facts: [],
  factsByGroup: {
    identity: [],
    life: [],
    career: [],
    family: [],
    awards: [],
    links: [],
    other: [],
  },
  sourcesUsed: ['wikidata'],
  sourceUris: { wikidata: 'http://www.wikidata.org/entity/Q1' },
  ...overrides,
})

describe('buildInfobox', () => {
  it('builds person infobox rows from facts', () => {
    const profile = baseProfile({
      facts: [
        {
          predicate: 'p',
          predicateLabel: 'occupation',
          value: 'film actor',
          source: 'wikidata',
          group: 'career',
        },
        {
          predicate: 'p',
          predicateLabel: 'country of citizenship',
          value: 'India',
          source: 'wikidata',
          group: 'identity',
        },
      ],
      factsByGroup: {
        identity: [
          {
            predicate: 'p',
            predicateLabel: 'country of citizenship',
            value: 'India',
            source: 'wikidata',
            group: 'identity',
          },
        ],
        life: [],
        career: [
          {
            predicate: 'p',
            predicateLabel: 'occupation',
            value: 'film actor',
            source: 'wikidata',
            group: 'career',
          },
        ],
        family: [],
        awards: [],
        links: [],
        other: [],
      },
    })

    const box = buildInfobox(profile, 'person')
    expect(box.some((r) => r.label === 'Occupation' && r.values[0].text === 'film actor')).toBe(true)
    expect(box.some((r) => r.label === 'Citizenship')).toBe(true)
  })
})
