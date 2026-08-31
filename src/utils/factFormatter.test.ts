import { describe, expect, it } from 'vitest'
import {
  formatFactDisplay,
  formatRevenue,
  isRawQid,
  pickCeoNames,
} from './factFormatter'

describe('factFormatter', () => {
  it('formats revenue in billions', () => {
    expect(formatRevenue('391035000000')).toBe('$391.0 billion')
    expect(formatRevenue('233715000000')).toBe('$233.7 billion')
  })

  it('filters Q-ids', () => {
    expect(isRawQid('Q19837')).toBe(true)
    const f = formatFactDisplay('chief executive officer', [
      'Tim Cook',
      'Q19837',
      'John Sculley',
    ])
    expect(f.display).not.toContain('Q19837')
    expect(pickCeoNames(['Tim Cook', 'Q19837', 'John Sculley'])).toContain('Tim Cook')
  })

  it('picks top revenue figure', () => {
    const f = formatFactDisplay('revenue', ['233715000000', '391035000000', '182795000000'])
    expect(f.display).toBe('$391.0 billion')
  })

  it('formats net profit and market cap', () => {
    expect(formatFactDisplay('net profit', ['45687000000']).display).toBe('$45.7 billion')
    expect(formatFactDisplay('market capitalization', ['1000000000000']).display).toBe(
      '$1.0 trillion',
    )
  })
})
