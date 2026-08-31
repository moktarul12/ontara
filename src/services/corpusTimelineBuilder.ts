import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'
import { buildOrgDashboardData } from './orgDashboardBuilder'
import { isHistoryChapter, splitTimelineParagraph } from '../utils/wikiTimelineParagraphs'

export type CorpusTimelineEventKind = 'work' | 'award' | 'life' | 'milestone'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export type CorpusTimelineEvent = {
  year: number
  month?: number
  monthLabel?: string
  kind: CorpusTimelineEventKind
  title: string
  subtitle: string
  awardResult?: 'won' | 'nominated'
}

export type CorpusTimelineMonth = {
  month?: number
  monthLabel: string
  events: CorpusTimelineEvent[]
}

export type CorpusTimelineYear = {
  year: number
  months: CorpusTimelineMonth[]
  events: CorpusTimelineEvent[]
}

export type CorpusTimelineData = {
  years: CorpusTimelineYear[]
  totalDated: number
  rangeStart?: number
  rangeEnd?: number
}

export function parseYearMonth(raw?: string): {
  year?: number
  month?: number
  monthLabel?: string
} {
  if (!raw) return {}
  const text = raw.trim()

  const named = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(1[89]\d{2}|20\d{2})\b/i,
  )
  if (named) {
    const monthLabel = named[1].charAt(0).toUpperCase() + named[1].slice(1).toLowerCase()
    const month = MONTH_NAMES.findIndex((m) => m.toLowerCase() === monthLabel.toLowerCase()) + 1
    return { year: parseInt(named[2], 10), month, monthLabel }
  }

  const iso = text.match(/\b(1[89]\d{2}|20\d{2})[-/](0?[1-9]|1[0-2])\b/)
  if (iso) {
    const month = parseInt(iso[2], 10)
    return { year: parseInt(iso[1], 10), month, monthLabel: MONTH_NAMES[month - 1] }
  }

  const y = text.match(/\b(1[89]\d{2}|20\d{2})\b/)
  return y ? { year: parseInt(y[1], 10) } : {}
}

function walkSections(sections: ArticleSection[], fn: (s: ArticleSection) => void) {
  for (const s of sections) {
    fn(s)
    if (s.children.length) walkSections(s.children, fn)
  }
}

function worksFromWikiTables(dossier: EntityDossier) {
  const out: { year?: string; title: string; role?: string }[] = []
  const sections = dossier.wikipedia?.sections ?? []
  walkSections(sections, (s) => {
    for (const t of s.tables ?? []) {
      if (!/filmography|works|discography|selected/i.test(t.title) && t.id !== 'filmography') continue
      for (const row of t.rows) {
        const title = row.title?.trim()
        if (!title) continue
        out.push({
          year: row.year !== '—' ? row.year : undefined,
          title,
          role: row.role && row.role !== '—' ? row.role : undefined,
        })
      }
    }
  })
  return out
}

function awardsFromWikiTables(dossier: EntityDossier) {
  const out: { year?: string; name: string; result: 'won' | 'nominated' }[] = []
  const sections = dossier.wikipedia?.sections ?? []
  walkSections(sections, (s) => {
    for (const t of s.tables ?? []) {
      if (!/award|honou?r/i.test(t.title)) continue
      for (const row of t.rows) {
        const name = (row.award ?? row.title)?.trim()
        if (!name) continue
        out.push({
          year: row.year !== '—' ? row.year : undefined,
          name,
          result: /nominated/i.test(row.result ?? '') ? 'nominated' : 'won',
        })
      }
    }
  })
  return out
}

function wikiHistoryEvents(dossier: EntityDossier) {
  const out: (Omit<CorpusTimelineEvent, 'year'> & { year?: number })[] = []
  const sections = dossier.wikipedia?.sections ?? []

  const walk = (list: ArticleSection[], inHistory: boolean) => {
    for (const s of list) {
      const history = inHistory || isHistoryChapter(s)
      if (history && (s.paragraphs?.length ?? 0) > 0) {
        for (const p of s.paragraphs ?? []) {
          const { heading, body } = splitTimelineParagraph(p)
          const dateSrc = heading ?? p
          const { year, month, monthLabel } = parseYearMonth(dateSrc)
          if (!year || !body || body.length < 20) continue
          const title =
            body.split(/[.!?]/)[0]?.trim().slice(0, 96) ||
            s.title.replace(/\s*\[edit\]\s*$/i, '')
          out.push({
            year,
            month,
            monthLabel,
            kind: 'milestone',
            title,
            subtitle: body.length > 220 ? `${body.slice(0, 217)}…` : body,
          })
        }
      }
      if (s.children.length) walk(s.children, history)
    }
  }

  walk(sections, false)
  return out
}

function groupByYearMonth(events: CorpusTimelineEvent[]): CorpusTimelineYear[] {
  const byYear = new Map<number, CorpusTimelineEvent[]>()
  for (const e of events) {
    const list = byYear.get(e.year) ?? []
    list.push(e)
    byYear.set(e.year, list)
  }

  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, evts]) => {
      const byMonth = new Map<number | 'none', CorpusTimelineEvent[]>()
      for (const e of evts) {
        const key = e.month ?? ('none' as const)
        const list = byMonth.get(key) ?? []
        list.push(e)
        byMonth.set(key, list)
      }

      const monthKeys = [...byMonth.keys()].sort((a, b) => {
        if (a === 'none') return 1
        if (b === 'none') return -1
        return (b as number) - (a as number)
      })

      const months: CorpusTimelineMonth[] = monthKeys.map((key) => {
        const monthEvents = byMonth.get(key) ?? []
        monthEvents.sort((a, b) => a.title.localeCompare(b.title))
        if (key === 'none') {
          return { month: undefined, monthLabel: 'General', events: monthEvents }
        }
        return {
          month: key as number,
          monthLabel: monthEvents[0]?.monthLabel ?? MONTH_NAMES[(key as number) - 1],
          events: monthEvents,
        }
      })

      return { year, months, events: evts }
    })
}

export function buildCorpusTimeline(dossier: EntityDossier): CorpusTimelineData {
  const events: CorpusTimelineEvent[] = []
  const seen = new Set<string>()

  const add = (e: Omit<CorpusTimelineEvent, 'year'> & { year?: number }) => {
    if (e.year === undefined || Number.isNaN(e.year)) return
    const key = `${e.year}|${e.month ?? ''}|${e.kind}|${e.title}|${e.subtitle}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    events.push({ ...e, year: e.year })
  }

  const works = [...dossier.works.items, ...worksFromWikiTables(dossier)]
  for (const w of works) {
    const { year, month, monthLabel } = parseYearMonth(w.year)
    if (!year || !w.title) continue
    const role = w.role?.trim()
    add({
      year,
      month,
      monthLabel,
      kind: 'work',
      title: w.title,
      subtitle: role ? `Released — ${role}` : 'Released',
    })
  }

  const wikiAwards = awardsFromWikiTables(dossier)
  const awards = [
    ...dossier.awards.won.map((a) => ({ ...a, result: 'won' as const })),
    ...dossier.awards.nominated.map((a) => ({ ...a, result: 'nominated' as const })),
    ...wikiAwards,
  ]
  for (const a of awards) {
    const { year, month, monthLabel } = parseYearMonth(a.year)
    if (!year || !a.name) continue
    add({
      year,
      month,
      monthLabel,
      kind: 'award',
      title: a.name,
      subtitle: a.result === 'nominated' ? 'Nominated' : 'Won',
      awardResult: a.result,
    })
  }

  for (const m of dossier.life.timeline) {
    const { year, month, monthLabel } = parseYearMonth(m.year ?? m.detail)
    add({
      year,
      month,
      monthLabel,
      kind: 'life',
      title: m.label,
      subtitle: m.detail ?? 'Life event',
    })
  }

  for (const m of dossier.aiProfile?.timeline ?? []) {
    const { year, month, monthLabel } = parseYearMonth(m.year ?? m.detail)
    add({
      year,
      month,
      monthLabel,
      kind: 'milestone',
      title: m.label,
      subtitle: m.detail ?? 'Career milestone',
    })
  }

  if (dossier.kind === 'org') {
    for (const m of buildOrgDashboardData(dossier).timeline) {
      const { year, month, monthLabel } = parseYearMonth(m.year ?? m.detail)
      add({
        year,
        month,
        monthLabel,
        kind: 'milestone',
        title: m.label,
        subtitle: m.detail ?? 'Company milestone',
      })
    }
  }

  for (const e of wikiHistoryEvents(dossier)) {
    add(e)
  }

  const years = groupByYearMonth(events)
  const datedYears = years.map((y) => y.year)
  return {
    years,
    totalDated: events.length,
    rangeStart: datedYears.length ? Math.min(...datedYears) : undefined,
    rangeEnd: datedYears.length ? Math.max(...datedYears) : undefined,
  }
}

export function corpusTimelineCount(dossier: EntityDossier): number {
  return buildCorpusTimeline(dossier).totalDated
}
