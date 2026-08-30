import { describe, expect, it } from 'vitest'
import { languageDisplayName, pickLanguageVariant } from './entityLanguages'

describe('pickLanguageVariant', () => {
  const variants = [
    { lang: 'en', label: 'Shah Rukh Khan', description: 'Indian actor' },
    { lang: 'hi', label: 'शाहरुख़ ख़ान', description: 'भारतीय अभिनेता' },
    { lang: 'fr', label: 'Shahrukh Khan', description: 'Acteur indien' },
  ]

  it('returns preferred language when available', () => {
    expect(pickLanguageVariant(variants, 'hi')?.label).toBe('शाहरुख़ ख़ान')
  })

  it('falls back to English then first variant', () => {
    expect(pickLanguageVariant(variants, 'de')?.lang).toBe('en')
  })
})

describe('languageDisplayName', () => {
  it('shows readable name with code', () => {
    expect(languageDisplayName('hi')).toContain('hi')
  })
})
