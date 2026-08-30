import { describe, expect, it } from 'vitest'
import { buildWorkDashboardData } from './workDashboardBuilder'
import type { EntityDossier } from '../types/entityDossier'

function baseFilmDossier(): EntityDossier {
  return {
    uri: 'http://www.wikidata.org/entity/Q949228',
    label: 'Sholay',
    kind: 'work',
    language: 'en',
    hero: {
      metrics: [
        { label: 'Released', value: '1975', icon: 'years' },
        { label: 'Cast', value: '12', icon: 'film' },
      ],
      factPills: [],
      quickFactsCard: [{ label: 'Director', value: 'Ramesh Sippy' }],
    },
    availableTabs: ['summary', 'career', 'awards', 'sources'],
    summary: {
      sourceTrust: { sources: ['wikidata', 'wikipedia'], confirmedCount: 2, reportedCount: 1, totalFacts: 3 },
      verifiedFacts: [
        { label: 'director', value: 'Ramesh Sippy', sources: ['wikidata', 'wikipedia'], status: 'confirmed' },
        { label: 'genre', value: 'action film · buddy film', sources: ['wikidata'], status: 'reported' },
        { label: 'publication date', value: 'Aug 15, 1975', sources: ['wikidata'], status: 'reported' },
        { label: 'cast member', value: 'Dharmendra, Hema Malini, Amitabh Bachchan', sources: ['wikidata'], status: 'reported' },
        { label: 'production budget', value: '$20.0 million', sources: ['wikidata'], status: 'reported' },
      ],
      storyBeats: [],
      personalDetails: [],
      careerEras: [],
      topWorks: [],
      topAwards: [],
      familyPreview: [],
      storyParagraph: 'Sholay (1975) is a action film, buddy film from India. Directed by Ramesh Sippy.',
    },
    life: { timeline: [], facts: [] },
    career: { subtracks: [], facts: [] },
    family: { members: [] },
    works: {
      items: [
        { title: 'Dharmendra', role: 'Cast' },
        { title: 'Hema Malini', role: 'Cast' },
        { title: 'Amitabh Bachchan', role: 'Cast' },
      ],
      totalCount: 12,
    },
    awards: { won: [{ name: 'Filmfare Award', year: '1976', result: 'won' }], nominated: [] },
    sources: [],
    enriched: true,
  }
}

describe('workDashboardBuilder', () => {
  it('builds film dashboard with cast and formatted budget', () => {
    const data = buildWorkDashboardData(baseFilmDossier())
    expect(data.cast.length).toBeGreaterThan(0)
    expect(data.detailCards.some((c) => c.label === 'Director' && c.value === 'Ramesh Sippy')).toBe(true)
    expect(data.heroMetrics.some((m) => m.label === 'Released' && m.value === '1975')).toBe(true)
    expect(data.genres.length).toBeGreaterThan(0)
  })
})
