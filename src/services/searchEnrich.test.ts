import { describe, expect, it } from 'vitest'
import {
  buildSearchCategoryChips,
  filterSearchHits,
  inferKindFromQuery,
  searchResultSummary,
} from './searchEnrich'
import type { SearchHitDetail } from '../types/ontology'

const sample = (partial: Partial<SearchHitDetail> & Pick<SearchHitDetail, 'uri' | 'label'>): SearchHitDetail => ({
  kind: 'entity',
  categoryLabel: 'Entity',
  ...partial,
})

describe('inferKindFromQuery', () => {
  it('detects company queries', () => {
    expect(inferKindFromQuery('retail store')).toBe('org')
  })

  it('detects actor queries', () => {
    expect(inferKindFromQuery('bollywood actor')).toBe('person')
  })
})

describe('buildSearchCategoryChips', () => {
  it('builds kind and specific category chips', () => {
    const hits = [
      sample({ uri: '1', label: 'A', kind: 'person', categoryLabel: 'film actor' }),
      sample({ uri: '2', label: 'B', kind: 'person', categoryLabel: 'film actor' }),
      sample({ uri: '3', label: 'C', kind: 'org', categoryLabel: 'retail company' }),
    ]
    const chips = buildSearchCategoryChips(hits)
    expect(chips.some((c) => c.label.startsWith('All'))).toBe(true)
    expect(chips.some((c) => c.label.includes('People'))).toBe(true)
    expect(chips.some((c) => c.label.includes('film actor'))).toBe(true)
  })
})

describe('filterSearchHits', () => {
  const hits = [
    sample({ uri: '1', label: 'A', kind: 'org', categoryLabel: 'retail company' }),
    sample({ uri: '2', label: 'B', kind: 'person', categoryLabel: 'film actor' }),
  ]

  it('filters by kind', () => {
    expect(filterSearchHits(hits, { type: 'kind', kind: 'org' })).toHaveLength(1)
  })
})

describe('searchResultSummary', () => {
  it('summarizes mixed results', () => {
    const text = searchResultSummary([
      sample({ uri: '1', label: 'A', kind: 'person', categoryLabel: 'x' }),
      sample({ uri: '2', label: 'B', kind: 'org', categoryLabel: 'y' }),
    ])
    expect(text).toContain('people')
    expect(text).toContain('organizations')
  })
})
