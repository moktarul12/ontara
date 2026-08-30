/** Format and clean raw Wikidata / SPARQL values for human reading. */

export function isRawQid(value: string): boolean {
  return /^Q\d+$/i.test(value.trim())
}

export function parseNumeric(raw: string): number | null {
  const n = parseFloat(String(raw).replace(/,/g, '').replace(/^\+/, ''))
  return Number.isFinite(n) ? n : null
}

export function formatRevenue(raw: string): string {
  const n = parseNumeric(raw)
  if (n === null) return raw
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(abs / 1e12).toFixed(1)} trillion`
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(1)} billion`
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)} million`
  return `$${abs.toLocaleString('en-US')}`
}

export function formatBudget(raw: string): string {
  return formatRevenue(raw)
}

export function formatDuration(raw: string): string {
  const sec = parseNumeric(raw)
  if (sec === null) return raw
  if (sec >= 3600) {
    const h = Math.floor(sec / 3600)
    const m = Math.round((sec % 3600) / 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const m = Math.round(sec / 60)
  return m ? `${m} min` : raw
}

export function formatRating(raw: string): string {
  const n = parseNumeric(raw)
  if (n === null) return raw
  if (n <= 10) return `${n.toFixed(1)}/10`
  return raw
}

export function formatEmployees(raw: string): string {
  const n = parseNumeric(raw)
  if (n === null) return raw
  return n.toLocaleString('en-US')
}

export function cleanValues(values: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of values) {
    const t = v.trim()
    if (!t || isRawQid(t)) continue
    const key = t.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

const HISTORIC_CEO_HINT =
  /markkula|sculley|spindler|amelio|michael scott|steve jobs died/i

export function pickCeoNames(values: string[]): string[] {
  const clean = cleanValues(values)
  if (clean.length <= 2) return clean
  const current = clean.filter((n) => !HISTORIC_CEO_HINT.test(n))
  if (current.length) return current.slice(-2)
  return clean.slice(-2)
}

export function pickTopNumeric(values: string[], limit = 1): string[] {
  const ranked = cleanValues(values)
    .map((v) => ({ v, n: parseNumeric(v) }))
    .filter((x): x is { v: string; n: number } => x.n !== null)
    .sort((a, b) => b.n - a.n)
  return ranked.slice(0, limit).map((x) => x.v)
}

export type FormattedFact = {
  label: string
  display: string
  values?: string[]
  rawValues: string[]
}

export function formatFactDisplay(label: string, values: string[]): FormattedFact {
  const clean = cleanValues(values)
  const key = label.toLowerCase()

  if (!clean.length) {
    return { label, display: '—', rawValues: values }
  }

  if (key === 'revenue' || key === 'production budget' || key === 'box office') {
    const top = pickTopNumeric(clean, key === 'revenue' ? 3 : 1)
    const formatted = top.map(formatRevenue)
    return {
      label: key === 'production budget' ? 'Budget' : key === 'box office' ? 'Box Office' : label,
      display: formatted[0],
      values: key === 'revenue' && formatted.length > 1 ? formatted : undefined,
      rawValues: values,
    }
  }

  if (key === 'employees') {
    const top = pickTopNumeric(clean, 2)
    const formatted = top.map(formatEmployees)
    return {
      label,
      display: formatted[0],
      values: formatted.length > 1 ? formatted : undefined,
      rawValues: values,
    }
  }

  if (key === 'chief executive officer') {
    const ceos = pickCeoNames(clean)
    return {
      label: 'CEO',
      display: ceos.join(', '),
      values: ceos.length > 1 ? ceos : undefined,
      rawValues: values,
    }
  }

  if (key === 'genre') {
    const uniq = [...new Set(clean)].slice(0, 4)
    return {
      label,
      display: uniq.slice(0, 2).join(' · '),
      values: uniq.length > 2 ? uniq : undefined,
      rawValues: values,
    }
  }

  if (key === 'cast member') {
    const cast = clean.slice(0, 6)
    return {
      label: 'Cast',
      display: cast.slice(0, 3).join(', '),
      values: cast.length > 3 ? cast : undefined,
      rawValues: values,
    }
  }

  if (key === 'duration') {
    return {
      label,
      display: formatDuration(clean[0]),
      rawValues: values,
    }
  }

  if (key === 'review score') {
    return {
      label: 'IMDb Rating',
      display: formatRating(clean[0]),
      rawValues: values,
    }
  }

  if (key === 'industry') {
    const uniq = [...new Set(clean)].slice(0, 3)
    return {
      label,
      display: uniq.join(' · '),
      values: uniq.length > 1 ? uniq : undefined,
      rawValues: values,
    }
  }

  if (/date|release|founded|inception|born|died/i.test(key)) {
    const formatted = clean.map(formatDisplayDate)
    return {
      label,
      display: formatted[0],
      values: formatted.length > 1 ? formatted : undefined,
      rawValues: values,
    }
  }

  return {
    label,
    display: clean[0],
    values: clean.length > 1 ? clean.slice(0, 5) : undefined,
    rawValues: values,
  }
}

export function formatDisplayDate(raw: string): string {
  const wd = raw.match(/([+-]?\d{4})-(\d{2})-(\d{2})/)
  if (wd) {
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    const y = wd[1].replace(/^\+/, '')
    return `${months[parseInt(wd[2], 10) - 1]} ${parseInt(wd[3], 10)}, ${y}`
  }
  const y = raw.match(/([+-]?\d{4})/)
  return y ? y[1].replace(/^\+/, '') : raw
}

export function formatFactValue(label: string, raw: string): string {
  return formatFactDisplay(label, [raw]).display
}
