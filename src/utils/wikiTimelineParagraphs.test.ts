import { describe, expect, it } from 'vitest'
import {
  isEraTimelineTitle,
  isHistoryChapter,
  splitTimelineParagraph,
} from './wikiTimelineParagraphs'

describe('wikiTimelineParagraphs', () => {
  it('detects history chapters', () => {
    expect(isHistoryChapter({ id: 'history', title: 'History' })).toBe(true)
    expect(isHistoryChapter({ id: 'products', title: 'Products' })).toBe(false)
  })

  it('detects era timeline titles', () => {
    expect(isEraTimelineTitle('1976–1984: Founding and incorporation')).toBe(true)
    expect(isEraTimelineTitle('Early life')).toBe(false)
  })

  it('splits On-date paragraph openings', () => {
    expect(
      splitTimelineParagraph(
        'On December 12, 1980, Apple became a public company through an initial public offering.',
      ),
    ).toEqual({
      heading: 'On December 12, 1980,',
      body: 'Apple became a public company through an initial public offering.',
    })
  })

  it('leaves normal paragraphs unchanged', () => {
    const body =
      'Apple Computer Company was founded as a partnership on April 1, 1976, by Steve Jobs.'
    expect(splitTimelineParagraph(body)).toEqual({ body })
  })
})
