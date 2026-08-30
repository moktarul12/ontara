import { describe, expect, it } from 'vitest'
import { buildOrgDashboardData } from './orgDashboardBuilder'
import type { EntityDossier } from '../types/entityDossier'

function baseDossier(overrides: Partial<EntityDossier> = {}): EntityDossier {
  return {
    uri: 'http://www.wikidata.org/entity/Q312',
    label: 'Apple Inc.',
    kind: 'org',
    language: 'en',
    hero: {
      metrics: [{ label: 'Founded', value: '1976', icon: 'years' }],
      factPills: [],
      quickFactsCard: [
        { label: 'Industry', value: 'consumer electronics' },
        { label: 'CEO', value: 'Tim Cook' },
      ],
    },
    availableTabs: ['summary', 'career', 'sources'],
    summary: {
      sourceTrust: { sources: ['wikidata'], confirmedCount: 1, reportedCount: 2, totalFacts: 3 },
      verifiedFacts: [
        { label: 'instance of', value: 'public company', sources: ['wikidata'], status: 'reported' },
        { label: 'company milestone', value: '1976|Company founded', sources: ['wikidata'], status: 'reported' },
        { label: 'company milestone', value: '2007|iPhone announced', sources: ['wikidata'], status: 'reported' },
        { label: 'inception', value: 'Apr 1, 1976', sources: ['wikidata'], status: 'reported' },
        { label: 'employees', value: '164,000', sources: ['wikidata'], status: 'reported' },
        { label: 'chief executive officer', value: 'Tim Cook', sources: ['wikidata'], status: 'reported' },
        { label: 'ticker symbol', value: 'AAPL', sources: ['wikidata'], status: 'reported' },
        { label: 'stock exchange', value: 'NASDAQ', sources: ['wikidata'], status: 'reported' },
      ],
      storyBeats: [],
      personalDetails: [],
      careerEras: [],
      topWorks: [],
      topAwards: [],
      familyPreview: [],
      storyParagraph: 'Apple Inc. is a major player in consumer electronics.',
    },
    life: { timeline: [], facts: [] },
    career: { subtracks: [], facts: [] },
    family: { members: [] },
    works: { items: [], totalCount: 0 },
    awards: { won: [], nominated: [] },
    sources: [],
    enriched: true,
    ...overrides,
  }
}

describe('orgDashboardBuilder', () => {
  it('builds corporate dashboard stats and company history timeline', () => {
    const data = buildOrgDashboardData(baseDossier())
    expect(data.typeTags).toContain('public company')
    expect(data.heroMetrics.some((m) => m.label === 'Founded')).toBe(true)
    expect(data.keyPeople[0]?.name).toBe('Tim Cook')
    expect(data.ticker).toBe('AAPL')
    expect(data.timeline.length).toBeGreaterThanOrEqual(2)
    expect(data.timeline.some((t) => t.year === '1976')).toBe(true)
    expect(data.timeline.some((t) => t.label.includes('iPhone'))).toBe(true)
  })
})
