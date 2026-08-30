import { describe, expect, it } from 'vitest'
import {
  mergeTimeline,
  parseDateYear,
  timelineFromDataProperties,
} from './timelineDates'

describe('timelineDates', () => {
  it('parses Wikidata ISO dates', () => {
    expect(parseDateYear('+1942-10-11T00:00:00Z')).toBe(1942)
    expect(parseDateYear('2008')).toBe(2008)
  })

  it('extracts birth and publication dates from properties', () => {
    const rows = timelineFromDataProperties(
      [
        {
          predicate: 'http://www.wikidata.org/prop/direct/P569',
          predicateLabel: 'date of birth',
          value: '+1942-10-11T00:00:00Z',
        },
        {
          predicate: 'http://www.wikidata.org/prop/direct/P577',
          predicateLabel: 'publication date',
          value: '+2008-07-18T00:00:00Z',
        },
      ],
      'The Dark Knight',
    )
    expect(rows.some((r) => r.year === 1942)).toBe(true)
    expect(rows.some((r) => r.year === 2008)).toBe(true)
  })

  it('merges without duplicates', () => {
    const merged = mergeTimeline(
      [{ year: 1975, label: 'Sholay', predicateLabel: 'publication date' }],
      [{ year: 1975, label: 'Sholay', predicateLabel: 'publication date' }],
    )
    expect(merged).toHaveLength(1)
  })
})
