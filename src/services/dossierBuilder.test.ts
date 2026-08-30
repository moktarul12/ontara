import { describe, expect, it } from 'vitest'
import { buildEntityDossier } from './dossierBuilder'
import type { EntityArticle } from '../types/entityArticle'
import type { EntityProfile } from './entityProfile'

const profile: EntityProfile = {
  uri: 'http://www.wikidata.org/entity/Q9570',
  label: 'Amitabh Bachchan',
  kind: 'person',
  classes: ['human'],
  facts: [
    {
      predicate: 'p',
      predicateLabel: 'date of birth',
      value: '1942-10-11',
      source: 'wikidata',
      group: 'life',
    },
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
    life: [
      {
        predicate: 'p',
        predicateLabel: 'date of birth',
        value: '1942-10-11',
        source: 'wikidata',
        group: 'life',
      },
    ],
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
  sourcesUsed: ['wikidata'],
  sourceUris: { wikidata: 'http://www.wikidata.org/entity/Q9570' },
}

const article: EntityArticle = {
  uri: profile.uri,
  qid: 'Q9570',
  label: 'Amitabh Bachchan',
  kind: 'person',
  language: 'en',
  lead: { text: 'Amitabh Bachchan is an Indian actor.', source: 'wikipedia' },
  infobox: [
    { label: 'Born', values: [{ text: '1942-10-11 in India' }] },
    { label: 'Occupation', values: [{ text: 'film actor' }] },
  ],
  sections: [],
  references: [],
  sourcesUsed: ['wikidata', 'wikipedia'],
}

describe('buildEntityDossier', () => {
  it('builds tabbed dossier with summary and life', () => {
    const dossier = buildEntityDossier(article, profile)
    expect(dossier.availableTabs).toContain('summary')
    expect(dossier.availableTabs).toContain('life')
    expect(dossier.summary.about).toContain('Indian actor')
    expect(dossier.hero.quickFactsCard.length).toBeGreaterThan(0)
    expect(dossier.hero.factPills.length).toBeGreaterThan(0)
    expect(dossier.life.timeline.length).toBeGreaterThan(0)
  })
})
