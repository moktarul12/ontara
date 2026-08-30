import { describe, expect, it } from 'vitest'
import {
  buildCompareSuggestions,
  compareSuggestionChips,
  idleCompareChips,
  isBollywoodContext,
} from './compareSuggestions'

describe('isBollywoodContext', () => {
  it('detects bollywood actor queries', () => {
    expect(isBollywoodContext('shah rukh khan', [])).toBe(true)
    expect(isBollywoodContext('amir khan', [])).toBe(true)
  })

  it('is false for unrelated queries', () => {
    expect(isBollywoodContext('apple store', [])).toBe(false)
  })
})

describe('buildCompareSuggestions', () => {
  it('includes wikidata category peers', () => {
    const suggestions = buildCompareSuggestions({
      query: '',
      pinnedUris: new Set(['http://www.wikidata.org/entity/Q1582970']),
      pinnedLabels: ["Lowe's"],
      graphNodes: [],
      graphLinks: [],
      searchHits: [],
      categoryPeers: [
        { uri: 'http://www.wikidata.org/entity/Q864407', label: 'Home Depot', reason: 'retail' },
        { uri: 'http://www.wikidata.org/entity/Q483551', label: 'Walmart', reason: 'retail' },
      ],
    })
    const labels = suggestions.map((s) => s.label)
    expect(labels).toContain('Home Depot')
    expect(labels).toContain('Walmart')
  })

  it('skips already pinned entities', () => {
    const uri = 'http://www.wikidata.org/entity/Q864407'
    const suggestions = buildCompareSuggestions({
      query: '',
      pinnedUris: new Set([uri]),
      pinnedLabels: ['Home Depot'],
      graphNodes: [],
      graphLinks: [],
      searchHits: [],
      categoryPeers: [{ uri, label: 'Home Depot', reason: 'retail' }],
    })
    expect(suggestions.some((s) => s.uri === uri)).toBe(false)
  })
})

describe('idleCompareChips', () => {
  it('prefers category peers over bollywood fallback', () => {
    const chips = idleCompareChips({
      pinnedUris: new Set(),
      pinnedLabels: ['Shah Rukh Khan'],
      categoryPeers: [
        { uri: 'http://www.wikidata.org/entity/Q9557', label: 'Aamir Khan', reason: 'film actor' },
      ],
    })
    expect(chips.map((c) => c.label)).toEqual(['Aamir Khan'])
  })
})

describe('compareSuggestionChips', () => {
  it('prefers contextual chips over duplicate search hits', () => {
    const all = [
      { uri: 'http://www.wikidata.org/entity/Q8096', label: 'Shah Rukh Khan', reason: 'Search result' },
      { uri: 'http://www.wikidata.org/entity/Q9557', label: 'Aamir Khan', reason: 'film actor' },
    ]
    const chips = compareSuggestionChips(all, [
      { uri: 'http://www.wikidata.org/entity/Q8096', label: 'Shah Rukh Khan' },
    ])
    expect(chips.map((c) => c.label)).toEqual(['Aamir Khan'])
  })
})
