import type { EntityDossier } from '../types/entityDossier'
import { buildCorpusTimeline } from './corpusTimelineBuilder'

export type CorpusYearOutput = {
  year: number
  works: number
  awardsWon: number
  nominations: number
}

export type CorpusDataStats = {
  worksCount: number
  awardsWon: number
  nominations: number
  activeSpan?: string
  busiestYear?: { year: number; count: number; label: string }
  yearlyOutput: CorpusYearOutput[]
  chartMax: number
}

function parseYear(raw?: string): number | undefined {
  if (!raw) return undefined
  const m = raw.match(/\b(1[89]\d{2}|20\d{2})\b/)
  return m ? parseInt(m[1], 10) : undefined
}

export function buildCorpusDataStats(dossier: EntityDossier): CorpusDataStats {
  const timeline = buildCorpusTimeline(dossier)
  const worksCount = dossier.works.totalCount || dossier.works.items.length || timeline.years.reduce(
    (n, y) => n + y.events.filter((e) => e.kind === 'work').length,
    0,
  )
  const awardsWon =
    dossier.awards.won.length ||
    timeline.years.reduce((n, y) => n + y.events.filter((e) => e.awardResult === 'won').length, 0)
  const nominations =
    dossier.awards.nominated.length ||
    timeline.years.reduce((n, y) => n + y.events.filter((e) => e.awardResult === 'nominated').length, 0)

  const yearMap = new Map<number, CorpusYearOutput>()
  const ensure = (year: number) => {
    let row = yearMap.get(year)
    if (!row) {
      row = { year, works: 0, awardsWon: 0, nominations: 0 }
      yearMap.set(year, row)
    }
    return row
  }

  for (const y of timeline.years) {
    for (const e of y.events) {
      const row = ensure(y.year)
      if (e.kind === 'work') row.works += 1
      else if (e.awardResult === 'won') row.awardsWon += 1
      else if (e.awardResult === 'nominated') row.nominations += 1
    }
  }

  for (const w of dossier.works.items) {
    const year = parseYear(w.year)
    if (!year) continue
    const row = ensure(year)
    if (row.works === 0) row.works += 1
  }

  const yearlyOutput = [...yearMap.values()].sort((a, b) => a.year - b.year)

  let busiestYear: CorpusDataStats['busiestYear']
  for (const row of yearlyOutput) {
    if (!busiestYear || row.works > busiestYear.count) {
      busiestYear = {
        year: row.year,
        count: row.works,
        label: `${row.year} with ${row.works} released work${row.works === 1 ? '' : 's'}`,
      }
    }
  }

  const dob = dossier.summary.verifiedFacts.find((f) => /date of birth/i.test(f.label))?.value
  const dobYear = parseYear(dob)
  const endYear = timeline.rangeEnd ?? new Date().getFullYear()
  const startYear = timeline.rangeStart ?? dobYear
  const activeSpan =
    startYear && endYear ? `${startYear}–${endYear}` : dobYear ? `${dobYear}–present` : undefined

  const chartMax = Math.max(
    12,
    ...yearlyOutput.map((y) => y.works + y.awardsWon + y.nominations),
  )

  return {
    worksCount,
    awardsWon,
    nominations,
    activeSpan,
    busiestYear,
    yearlyOutput,
    chartMax,
  }
}
