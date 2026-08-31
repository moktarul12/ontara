import { describe, expect, it } from 'vitest'
import { applyAiEntityProfile } from './applyAiEntityProfile'
import type { EntityDossier } from '../types/entityDossier'
import type { AiEntityProfile } from '../types/aiEntityProfile'

const baseDossier = (): EntityDossier =>
  ({
    uri: 'http://www.wikidata.org/entity/Q9570',
    qid: 'Q9570',
    label: 'Amitabh Bachchan',
    kind: 'person',
    language: 'en',
    enriched: true,
    hero: { metrics: [], factPills: [], quickFactsCard: [] },
    summary: {
      sourceTrust: { sources: ['wikidata'], confirmedCount: 2, reportedCount: 0, totalFacts: 2 },
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
    availableTabs: ['summary'],
    wikipedia: {
      leadText: 'Original lead',
      sections: [
        {
          id: 'early-life',
          title: 'Early life',
          level: 2,
          paragraphs: ['Wiki paragraph'],
          children: [],
        },
      ],
      infobox: [],
      externalLinks: [],
      categories: [],
    },
  }) as EntityDossier

const aiProfile: AiEntityProfile = {
  qid: 'Q9570',
  label: 'Amitabh Bachchan',
  kind: 'person',
  lang: 'en',
  source: 'llm',
  generatedAt: '2026-01-01T00:00:00Z',
  cacheVersion: 1,
  summary: {
    hook: 'Hook',
    thirtySecond: 'Thirty second summary.',
    narrative: 'Full narrative.',
  },
  timeline: [
    { year: '1942', label: 'Born', detail: 'Born in Allahabad.' },
    { year: '1973', label: 'Breakthrough', detail: 'Zanjeer changed everything.' },
  ],
  history: { narrative: 'A long history arc.', eras: [] },
  chapters: [
    {
      id: 'early-life',
      title: 'Early life',
      lead: 'AI lead paragraph.',
      paragraphs: ['AI body paragraph.'],
    },
  ],
}

describe('applyAiEntityProfile', () => {
  it('merges AI profile into dossier without replacing Wikipedia reading text', () => {
    const out = applyAiEntityProfile(baseDossier(), aiProfile)
    expect(out.aiProfile?.qid).toBe('Q9570')
    expect(out.summary.storyParagraph).toBeUndefined()
    expect(out.hero.intro).toBeUndefined()
    expect(out.life.timeline).toHaveLength(2)
    expect(out.wikipedia?.leadText).toBe('Original lead')
    expect(out.wikipedia?.sections[0].paragraphs?.[0]).toBe('Wiki paragraph')
    expect(out.categoryContent?.summaryNarrative).toBe('Thirty second summary.')
  })
})
