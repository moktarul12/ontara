import type { DataProperty } from '../types/ontology'

export interface TimelineEntry {
  year: number
  label: string
  predicateLabel: string
  sourceUri?: string
}

const DATE_PREDICATE_HINTS =
  /birth|death|inception|dissolved|publication|release|start|end|founded|date/i

/** Parse Wikidata-style date literals (+1879-03-14T00:00:00Z, 1879, etc.). */
export function parseDateYear(value: string): number | null {
  const v = (value || '').trim()
  if (!v) return null
  const iso = v.match(/([+-]?\d{4})(?:-\d{2}-\d{2})?/)
  if (iso) return Math.abs(Number(iso[1]))
  const yearOnly = v.match(/\b(1[89]\d{2}|20\d{2})\b/)
  if (yearOnly) return Number(yearOnly[1])
  return null
}

export function timelineFromDataProperties(
  props: DataProperty[],
  focusLabel?: string,
): TimelineEntry[] {
  const rows: TimelineEntry[] = []
  for (const p of props) {
    const blob = `${p.predicateLabel} ${p.predicate}`
    if (!DATE_PREDICATE_HINTS.test(blob)) {
      const year = parseDateYear(p.value)
      if (year && /date|time|year/i.test(blob)) {
        rows.push({
          year,
          label: p.value.slice(0, 80),
          predicateLabel: p.predicateLabel,
        })
      }
      continue
    }
    const year = parseDateYear(p.value)
    if (year == null) continue
    rows.push({
      year,
      label: focusLabel ? `${focusLabel} — ${p.predicateLabel}` : p.predicateLabel,
      predicateLabel: p.predicateLabel,
    })
  }
  return rows.sort((a, b) => a.year - b.year)
}

/** Fallback: extract years from node labels. */
export function timelineFromLabels(
  items: { id: string; label: string }[],
): TimelineEntry[] {
  const rows: TimelineEntry[] = []
  for (const n of items) {
    const m = n.label.match(/\b(1[89]\d{2}|20\d{2})\b/)
    if (m) {
      rows.push({
        year: Number(m[1]),
        label: n.label,
        predicateLabel: 'label',
        sourceUri: n.id,
      })
    }
  }
  return rows
}

export function mergeTimeline(
  ...lists: TimelineEntry[][]
): TimelineEntry[] {
  const seen = new Set<string>()
  const out: TimelineEntry[] = []
  for (const list of lists) {
    for (const e of list) {
      const key = `${e.year}:${e.predicateLabel}:${e.label}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(e)
    }
  }
  return out.sort((a, b) => a.year - b.year)
}
