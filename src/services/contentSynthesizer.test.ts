import { describe, expect, it } from 'vitest'
import { synthesizeNarrative } from './contentSynthesizer'
import type { VerifiedFact } from '../types/entityDossier'

describe('contentSynthesizer', () => {
  it('writes readable org narrative with formatted figures', () => {
    const facts: VerifiedFact[] = [
      { label: 'industry', value: 'consumer electronics', sources: ['wikidata'], status: 'reported' },
      { label: 'headquarters', value: 'Cupertino', sources: ['wikidata', 'wikipedia'], status: 'confirmed' },
      { label: 'chief executive officer', value: 'Tim Cook', sources: ['wikidata'], status: 'reported' },
      { label: 'employees', value: '164000', sources: ['wikidata'], status: 'reported' },
      { label: 'revenue', value: '391035000000', sources: ['wikidata'], status: 'reported' },
    ]
    const text = synthesizeNarrative('Apple Inc.', 'org', facts)
    expect(text).toContain('Apple Inc.')
    expect(text).toContain('Tim Cook')
    expect(text).toContain('164,000')
    expect(text).toContain('$391.0 billion')
    expect(text).not.toContain('233715000000')
  })
})
