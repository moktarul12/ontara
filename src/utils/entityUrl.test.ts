import { describe, expect, it } from 'vitest'
import { entityUrisMatch, hashForEntity, hashForMapSnapshot, parseHash } from './entityUrl'

describe('entityUrl map hash', () => {
  it('parses map snapshot id', () => {
    expect(parseHash('#/map/abc123', 'wikidata')).toEqual({
      type: 'map',
      snapshotId: 'abc123',
    })
  })

  it('builds map hash', () => {
    expect(hashForMapSnapshot('xyz')).toBe('#/map/xyz')
  })

  it('parses wiki chapter section in hash', () => {
    expect(parseHash('#/Q9570/w/early-life-and-family', 'wikidata')).toEqual({
      type: 'entity',
      uri: 'http://www.wikidata.org/entity/Q9570',
      overviewSection: 'w/early-life-and-family',
    })
  })

  it('builds wiki chapter hash', () => {
    expect(
      hashForEntity('http://www.wikidata.org/entity/Q9570', 'wikidata', 'w/acting-career'),
    ).toBe('#/Q9570/w/acting-career')
  })
})

describe('entityUrisMatch', () => {
  it('matches wikidata Q ids across formats', () => {
    expect(
      entityUrisMatch(
        'http://www.wikidata.org/entity/Q8096',
        'http://www.wikidata.org/entity/Q8096',
      ),
    ).toBe(true)
    expect(entityUrisMatch('Q8096', 'http://www.wikidata.org/entity/Q8096')).toBe(true)
  })
})
