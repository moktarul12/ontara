import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'

export type CorpusTimelineEventKind = 'work' | 'award' | 'life' | 'milestone'

export type CorpusTimelineEvent = {
  year: number
  kind: CorpusTimelineEventKind
  title: string
  subtitle: string
  awardResult?: 'won' | 'nominated'
}

export type CorpusTimelineYear = {
  year: number
  events: CorpusTimelineEvent[]
}

export type CorpusTimelineData = {
  years: CorpusTimelineYear[]
  totalDated: number
  rangeStart?: number
  rangeEnd?: number
}

function parseYear(raw?: string): number | undefined {
  if (!raw) return undefined
  const m = raw.match(/\b(1[89]\d{2}|20\d{2})\b/)
  return m ? parseInt(m[1], 10) : undefined
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

export function buildCorpusTimeline(dossier: EntityDossier): CorpusTimelineData {
  const events: CorpusTimelineEvent[] = []
  const seen = new Set<string>()

  const add = (e: Omit<CorpusTimelineEvent, 'year'> & { year?: number }) => {
    if (e.year === undefined || Number.isNaN(e.year)) return
    const key = `${e.year}|${e.kind}|${e.title}|${e.subtitle}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    events.push({ ...e, year: e.year })
  }

  const works = [...dossier.works.items, ...worksFromWikiTables(dossier)]
  for (const w of works) {
    const year = parseYear(w.year)
    if (!year || !w.title) continue
    const role = w.role?.trim()
    add({
      year,
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
    const year = parseYear(a.year)
    if (!year || !a.name) continue
    add({
      year,
      kind: 'award',
      title: a.name,
      subtitle: a.result === 'nominated' ? 'Nominated' : 'Won',
      awardResult: a.result,
    })
  }

  for (const m of dossier.life.timeline) {
    const year = parseYear(m.year)
    add({
      year,
      kind: 'life',
      title: m.label,
      subtitle: m.detail ?? 'Life event',
    })
  }

  for (const m of dossier.aiProfile?.timeline ?? []) {
    const year = parseYear(m.year)
    add({
      year,
      kind: 'milestone',
      title: m.label,
      subtitle: m.detail ?? 'Career milestone',
    })
  }

  events.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))

  const byYear = new Map<number, CorpusTimelineEvent[]>()
  for (const e of events) {
    const list = byYear.get(e.year) ?? []
    list.push(e)
    byYear.set(e.year, list)
  }

  const years = [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, evts]) => ({ year, events: evts }))

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
