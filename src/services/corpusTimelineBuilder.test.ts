import { describe, expect, it } from 'vitest'
import type { EntityDossier } from '../types/entityDossier'
import { buildCorpusTimeline, corpusTimelineCount, parseYearMonth } from './corpusTimelineBuilder'
import { buildCorpusDataStats } from './corpusDataBuilder'

function miniDossier(overrides: Partial<EntityDossier> = {}): EntityDossier {
  return {
    uri: 'http://www.wikidata.org/entity/Q9570',
    qid: 'Q9570',
    label: 'Test Person',
    kind: 'person',
    language: 'en',
    hero: { metrics: [], factPills: [], quickFactsCard: [] },
    availableTabs: ['summary'],
    summary: {
      sourceTrust: { sources: [], confirmedCount: 0, reportedCount: 0, totalFacts: 0 },
      verifiedFacts: [],
      storyBeats: [],
      personalDetails: [],
      careerEras: [],
      topWorks: [],
      topAwards: [],
      familyPreview: [],
    },
    life: { timeline: [], facts: [] },
    career: { subtracks: [], facts: [] },
    family: { members: [] },
    works: { items: [], totalCount: 0 },
    awards: { won: [], nominated: [] },
    sources: [],
    ...overrides,
  } as EntityDossier
}

describe('corpusTimelineBuilder', () => {
  it('groups works and awards by year descending', () => {
    const dossier = miniDossier({
      works: {
        totalCount: 3,
        items: [
          { title: 'Sholay', year: '1975', role: 'Actor' },
          { title: 'Kalki 2898 AD', year: '2024' },
          { title: 'Pink', year: '2016', role: 'Actor' },
        ],
      },
      awards: {
        won: [{ name: 'Padma Vibhushan', year: '2015', result: 'won' }],
        nominated: [],
      },
    })
    const data = buildCorpusTimeline(dossier)
    expect(data.totalDated).toBeGreaterThanOrEqual(4)
    expect(data.years[0].year).toBe(2024)
    expect(data.years.some((y) => y.year === 1975)).toBe(true)
    expect(corpusTimelineCount(dossier)).toBe(data.totalDated)
  })

  it('parses month from dated strings and nests under year', () => {
    expect(parseYearMonth('March 25, 1921')).toEqual({
      year: 1921,
      month: 3,
      monthLabel: 'March',
    })
    expect(parseYearMonth('1975')).toEqual({ year: 1975 })

    const dossier = miniDossier({
      life: {
        timeline: [
          { label: 'Born', year: 'March 25, 1921', detail: 'Birth in Mumbai' },
          { label: 'Debut', year: '1975', detail: 'Film debut' },
        ],
        facts: [],
      },
    })
    const data = buildCorpusTimeline(dossier)
    const y1921 = data.years.find((y) => y.year === 1921)
    expect(y1921?.months.some((m) => m.monthLabel === 'March')).toBe(true)
    const y1975 = data.years.find((y) => y.year === 1975)
    expect(y1975?.months.some((m) => m.monthLabel === 'General')).toBe(true)
  })
})

describe('corpusDataBuilder', () => {
  it('computes busiest year and active span', () => {
    const dossier = miniDossier({
      works: {
        totalCount: 4,
        items: [
          { title: 'A', year: '2005' },
          { title: 'B', year: '2005' },
          { title: 'C', year: '2005' },
          { title: 'D', year: '2010' },
        ],
      },
      awards: { won: [{ name: 'Award', year: '2010', result: 'won' }], nominated: [] },
      summary: {
        sourceTrust: { sources: [], confirmedCount: 0, reportedCount: 0, totalFacts: 0 },
        verifiedFacts: [{ label: 'date of birth', value: '1942', sources: ['wikidata'], status: 'confirmed' }],
        storyBeats: [],
        personalDetails: [],
        careerEras: [],
        topWorks: [],
        topAwards: [],
        familyPreview: [],
      },
    })
    const stats = buildCorpusDataStats(dossier)
    expect(stats.worksCount).toBe(4)
    expect(stats.busiestYear?.year).toBe(2005)
    expect(stats.busiestYear?.count).toBe(3)
    expect(stats.yearlyOutput.length).toBeGreaterThan(0)
  })
})
