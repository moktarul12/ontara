import { describe, expect, it } from 'vitest'
import { buildCategoryContent } from './entityTemplateEngine'
import type { EntityDossier } from '../types/entityDossier'

function baseOrgDossier(): EntityDossier {
  return {
    uri: 'http://www.wikidata.org/entity/Q312',
    label: 'Apple Inc.',
    kind: 'org',
    language: 'en',
    hero: { metrics: [], factPills: [], quickFactsCard: [] },
    availableTabs: ['summary'],
    summary: {
      sourceTrust: { sources: ['wikidata'], confirmedCount: 1, reportedCount: 0, totalFacts: 3 },
      verifiedFacts: [
        { label: 'industry', value: 'consumer electronics', sources: ['wikidata'], status: 'confirmed' },
        { label: 'inception', value: 'Apr 1, 1976', sources: ['wikidata'], status: 'confirmed' },
        { label: 'headquarters location', value: 'Cupertino', sources: ['wikidata'], status: 'confirmed' },
      ],
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
    enriched: true,
  }
}

describe('entityTemplateEngine', () => {
  it('builds org category sections from verified facts', () => {
    const dossier = baseOrgDossier()
    const content = buildCategoryContent(dossier, dossier.summary.verifiedFacts)
    expect(content?.templateId).toBe('org-corporate')
    expect(content?.kind).toBe('org')
    expect(content?.sections.some((s) => s.id === 'summary')).toBe(true)
    expect(content?.sections.some((s) => s.id === 'identity')).toBe(true)
    expect(content?.summaryNarrative).toMatch(/Apple Inc\./)
    const identity = content?.sections.find((s) => s.id === 'identity')
    expect(identity?.slots.some((sl) => sl.label === 'Industry')).toBe(true)
  })

  it('returns undefined for unsupported kinds', () => {
    const dossier = { ...baseOrgDossier(), kind: 'other' as const }
    expect(buildCategoryContent(dossier, dossier.summary.verifiedFacts)).toBeUndefined()
  })
})
