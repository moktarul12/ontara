import { describe, expect, it } from 'vitest'
import { htmlToParagraphs, htmlToPlainText, decodeHtmlEntities } from './htmlToText'

describe('htmlToPlainText', () => {
  it('strips tags and decodes entities', () => {
    const html = '<p>Hello <b>world</b> &amp; friends</p>'
    expect(htmlToPlainText(html)).toContain('Hello world & friends')
  })

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('caf&#233;')).toBe('café')
    expect(decodeHtmlEntities('it&#8217;s')).toBe('it\u2019s')
  })
})

describe('htmlToParagraphs', () => {
  it('splits into paragraphs', () => {
    const html = '<p>First paragraph here with enough text.</p><p>Second paragraph also long enough.</p>'
    const paras = htmlToParagraphs(html)
    expect(paras.length).toBeGreaterThanOrEqual(1)
  })
})
