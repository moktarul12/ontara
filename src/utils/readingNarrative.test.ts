import { describe, expect, it } from 'vitest'
import { buildReadingHook } from './readingNarrative'
import type { VerifiedFact } from '../types/entityDossier'

const sholayFacts: VerifiedFact[] = [
  {
    label: 'director',
    value: 'Ramesh Srivastava',
    sources: ['wikidata', 'wikipedia'],
    status: 'confirmed',
  },
  {
    label: 'genre',
    value: 'action film',
    sources: ['wikidata', 'wikipedia'],
    status: 'confirmed',
  },
  {
    label: 'publication date',
    value: '1975-08-15',
    sources: ['wikidata'],
    status: 'reported',
  },
  {
    label: 'cast member',
    value: 'Amitabh Bachchan',
    sources: ['wikidata', 'wikipedia'],
    status: 'confirmed',
  },
  {
    label: 'cast member',
    value: 'Dharmendra',
    sources: ['wikidata'],
    status: 'reported',
  },
  {
    label: 'country of origin',
    value: 'India',
    sources: ['wikidata', 'wikipedia'],
    status: 'confirmed',
  },
]

describe('buildReadingHook', () => {
  it('builds engaging work hook from facts', () => {
    const hook = buildReadingHook('Sholay', 'work', sholayFacts)
    expect(hook).toContain('Sholay')
    expect(hook).toContain('1975')
    expect(hook).toContain('Ramesh Srivastava')
    expect(hook).toContain('Amitabh Bachchan')
  })
})
