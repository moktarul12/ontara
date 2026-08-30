import type {
  EntityDossier,
  HeroMetric,
  Milestone,
  VerifiedFact,
} from '../types/entityDossier'
import { formatFactDisplay, formatDisplayDate } from '../utils/factFormatter'
import { enrichSparseTimeline } from '../utils/timelineEnrich'

export type PersonHighlight = { label: string; value: string; hint?: string }

export type PersonDetailCard = {
  label: string
  value: string
  status: 'confirmed' | 'reported'
  sources: string[]
}

export type PersonDashboardData = {
  typeTags: string[]
  heroMetrics: HeroMetric[]
  highlights: PersonHighlight[]
  detailCards: PersonDetailCard[]
  timeline: Milestone[]
  occupations: string[]
}

function factValues(facts: VerifiedFact[], ...labels: string[]): string[] {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  return facts
    .filter((f) => want.has(f.label.toLowerCase()))
    .flatMap((f) => f.values ?? [f.value])
}

function factDisplay(facts: VerifiedFact[], ...labels: string[]): string | undefined {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hit = facts.find((f) => want.has(f.label.toLowerCase()))
  if (!hit) return undefined
  if (hit.value && hit.value !== '—') return hit.value
  const raw = hit.values ?? []
  if (!raw.length) return undefined
  return formatFactDisplay(hit.label, raw).display
}

function detailFromFacts(facts: VerifiedFact[], labels: string[], displayLabel: string): PersonDetailCard | null {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hit = facts.find((f) => want.has(f.label.toLowerCase()))
  if (!hit) return null
  return { label: displayLabel, value: hit.value, status: hit.status, sources: hit.sources }
}

function yearsActiveFromDob(facts: VerifiedFact[]): string | undefined {
  const dob = factDisplay(facts, 'date of birth')
  const year = dob?.match(/\d{4}/)?.[0]
  if (!year) return undefined
  const span = new Date().getFullYear() - parseInt(year, 10)
  if (span >= 50) return '50+ Years'
  if (span >= 25) return `${span}+ Years`
  return undefined
}

function buildPersonTimeline(
  dossier: EntityDossier,
  facts: VerifiedFact[],
  born?: string,
  birthplace?: string,
): Milestone[] {
  const items: Milestone[] = []
  const seen = new Set<string>()
  const add = (m: Milestone) => {
    const key = `${m.year ?? ''}|${m.label}|${m.detail ?? ''}`.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    items.push(m)
  }

  for (const m of dossier.life.timeline) add(m)

  if (born) {
    add({
      year: born.match(/\d{4}/)?.[0],
      label: 'Born',
      detail: [formatDisplayDate(born), birthplace ? `in ${birthplace}` : '']
        .filter(Boolean)
        .join(' '),
    })
  }

  for (const w of dossier.summary.topWorks) {
    if (!w.year) continue
    add({
      year: w.year,
      label: w.title,
      detail: w.role ? `${w.role}` : 'Notable release',
    })
  }

  for (const a of dossier.summary.topAwards) {
    add({
      year: a.year,
      label: a.name,
      detail: a.result === 'won' ? 'Award received' : 'Nominated',
    })
  }

  for (const era of dossier.summary.careerEras) {
    const year = era.era.match(/\d{4}/)?.[0] ?? (/\d{4}/.test(era.era) ? era.era : undefined)
    add({
      year,
      label: era.title,
      detail: era.description ?? era.era,
    })
  }

  for (const edu of factValues(facts, 'educated at').slice(0, 2)) {
    add({ label: 'Education', detail: edu })
  }

  return items
    .sort((a, b) => parseInt(a.year ?? '9999', 10) - parseInt(b.year ?? '9999', 10))
    .slice(0, 10)
}

export function buildPersonDashboardData(dossier: EntityDossier): PersonDashboardData {
  const facts = dossier.summary.verifiedFacts
  const instanceTags = factValues(facts, 'instance of').slice(0, 2)
  const typeTags = ['Person', ...instanceTags, 'Wikidata'].filter(
    (t, i, arr) => arr.indexOf(t) === i,
  )
  const occupations = factValues(facts, 'occupation').slice(0, 4)
  const born = factDisplay(facts, 'date of birth')
  const birthplace = factDisplay(facts, 'place of birth')
  const nationality = factDisplay(facts, 'country of citizenship')
  const languages = factValues(facts, 'languages spoken', 'native language').slice(0, 2).join(', ')
  const awards = dossier.awards.won.length + dossier.awards.nominated.length
  const films = dossier.works.totalCount
  const active = yearsActiveFromDob(facts)

  const heroMetrics: HeroMetric[] = []
  if (awards) heroMetrics.push({ label: 'Awards', value: String(awards), icon: 'award' })
  if (active) heroMetrics.push({ label: 'In Industry', value: active.replace(' Years', ''), icon: 'years' })
  if (films) heroMetrics.push({ label: films >= 50 ? 'Films' : 'Works', value: films >= 100 ? '100+' : String(films), icon: 'film' })
  if (films >= 25 || awards >= 3) {
    heroMetrics.push({ label: 'Fans Worldwide', value: 'Millions', icon: 'star' })
  }
  if (!heroMetrics.length) heroMetrics.push(...dossier.hero.metrics)

  const highlights: PersonHighlight[] = []
  if (occupations.length) highlights.push({ label: 'Profession', value: occupations.slice(0, 2).join(', ') })
  const topAward = dossier.awards.won[0]?.name ?? factValues(facts, 'award received')[0]
  if (topAward) highlights.push({ label: 'Honoured with', value: topAward })
  if (nationality) highlights.push({ label: 'From', value: nationality })
  if (languages) highlights.push({ label: 'Speaks', value: languages })

  const detailLabels: [string, string[]][] = [
    ['Born', ['date of birth']],
    ['Birthplace', ['place of birth']],
    ['Nationality', ['country of citizenship']],
    ['Occupation', ['occupation']],
    ['Languages', ['languages spoken', 'native language']],
    ['Education', ['educated at']],
    ['Spouse', ['spouse', 'unmarried partner']],
    ['Awards', ['award received']],
  ]
  const detailCards = detailLabels
    .map(([label, keys]) => detailFromFacts(facts, keys, label))
    .filter((c): c is PersonDetailCard => c !== null && c.value !== '—')

  const aiTimeline =
    dossier.aiProfile?.timeline.map((t) => ({
      year: t.year,
      label: t.label,
      detail: t.detail,
    })) ?? []

  const timeline = (
    aiTimeline.length >= 4
      ? aiTimeline
      : enrichSparseTimeline(dossier, buildPersonTimeline(dossier, facts, born, birthplace))
  ).slice(0, 12)

  return {
    typeTags,
    heroMetrics: heroMetrics.slice(0, 4),
    highlights: highlights.slice(0, 4),
    detailCards: detailCards.slice(0, 12),
    timeline: timeline.slice(0, 8),
    occupations,
  }
}
