import { describe, expect, it } from 'vitest'
import {
  cleanWikiSectionTitle,
  normalizeSectionParagraphs,
  splitLongParagraph,
} from './sectionParagraphs'

describe('sectionParagraphs', () => {
  it('cleans [edit] from titles', () => {
    expect(cleanWikiSectionTitle('Early life and family[edit]')).toBe('Early life and family')
  })

  it('splits long paragraphs on sentences', () => {
    const long =
      'First sentence about the actor. Second sentence with more detail. Third sentence continues the story. Fourth sentence adds context. Fifth sentence wraps up the thought.'
    const parts = splitLongParagraph(long, 80)
    expect(parts.length).toBeGreaterThan(1)
  })

  it('normalizes multiple wiki blocks', () => {
    const paras = normalizeSectionParagraphs([
      'Short intro with enough length here.',
      'Early life[edit] Further information: Bachchan family. He was born in Allahabad and grew up there.',
    ])
    expect(paras.length).toBeGreaterThanOrEqual(2)
    expect(paras.join(' ')).not.toContain('[edit]')
  })
})
