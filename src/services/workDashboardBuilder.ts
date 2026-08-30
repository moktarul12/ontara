import type {
  EntityDossier,
  HeroMetric,
  Milestone,
  VerifiedFact,
  WorkCard,
} from '../types/entityDossier'
import { formatFactDisplay } from '../utils/factFormatter'
import { enrichSparseTimeline } from '../utils/timelineEnrich'

export type WorkHighlight = {
  label: string
  value: string
  hint?: string
}

export type WorkCastMember = {
  name: string
  role?: string
  imageUrl?: string
  uri?: string
}

export type WorkDetailCard = {
  label: string
  value: string
  status: 'confirmed' | 'reported'
  sources: string[]
}

export type WorkDashboardData = {
  genreTags: string[]
  heroMetrics: HeroMetric[]
  highlights: WorkHighlight[]
  keyStats: { icon: string; label: string; value: string }[]
  cast: WorkCastMember[]
  detailCards: WorkDetailCard[]
  genres: string[]
  timeline: Milestone[]
  imdbRating?: string
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

function detailFromFacts(facts: VerifiedFact[], labels: string[], displayLabel: string): WorkDetailCard | null {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hit = facts.find((f) => want.has(f.label.toLowerCase()))
  if (!hit) return null
  return {
    label: displayLabel,
    value: hit.value,
    status: hit.status,
    sources: hit.sources,
  }
}

export function buildWorkDashboardData(dossier: EntityDossier): WorkDashboardData {
  const facts = dossier.summary.verifiedFacts
  const genres = factValues(facts, 'genre')
  const genreTags = genres.slice(0, 6)
  const released = factDisplay(facts, 'publication date', 'release date')
  const year = released?.match(/\d{4}/)?.[0]
  const director = factDisplay(facts, 'director')
  const budget = factDisplay(facts, 'production budget', 'budget')
  const boxOffice = factDisplay(facts, 'box office')
  const imdbRating = factDisplay(facts, 'review score', 'IMDb Rating')
  const castNames = factValues(facts, 'cast member')
  const castCount = castNames.length || dossier.works.totalCount
  const awardCount = dossier.awards.won.length + dossier.awards.nominated.length

  const heroMetrics: HeroMetric[] = []
  if (year) heroMetrics.push({ label: 'Released', value: year, icon: 'years' })
  if (castCount) heroMetrics.push({ label: 'Cast', value: String(castCount), icon: 'film' })
  if (genres.length) heroMetrics.push({ label: 'Genres', value: String(genres.length), icon: 'star' })
  if (awardCount) {
    heroMetrics.push({
      label: awardCount >= 50 ? 'Honours' : 'Awards',
      value: awardCount >= 50 ? `${awardCount}+` : String(awardCount),
      icon: 'award',
    })
  }
  if (!heroMetrics.length) heroMetrics.push(...dossier.hero.metrics)

  const highlights: WorkHighlight[] = []
  if (director) highlights.push({ label: 'Director', value: director })
  if (castCount) highlights.push({ label: 'Cast', value: `${castCount} members`, hint: castNames.slice(0, 2).join(', ') })
  if (genres.length) highlights.push({ label: 'Genre', value: genres[0], hint: genres.slice(0, 3).join(' · ') })
  if (imdbRating) highlights.push({ label: 'Rating', value: imdbRating, hint: 'Review score' })
  else if (awardCount) highlights.push({ label: 'Awards', value: String(awardCount), hint: 'Honours received' })

  const keyStats = [
    director && { icon: '🎬', label: 'Director', value: director },
    castCount && { icon: '👥', label: 'Cast Members', value: String(castCount) },
    genres.length && { icon: '🎭', label: 'Genres', value: String(genres.length) },
    awardCount && { icon: '🏆', label: 'Awards Won', value: awardCount >= 50 ? `${awardCount}+` : String(awardCount) },
    imdbRating && { icon: '⭐', label: 'IMDb Rating', value: imdbRating },
  ].filter(Boolean) as WorkDashboardData['keyStats']

  const cast: WorkCastMember[] = (
    dossier.works.items.length ? dossier.works.items : castNames.map((name) => ({ title: name }))
  )
    .slice(0, 12)
    .map((w: WorkCard) => ({
      name: w.title,
      role: w.role && w.role !== 'Cast' ? w.role : undefined,
      imageUrl: w.imageUrl,
      uri: w.uri,
    }))

  const detailLabels: [string, string[]][] = [
    ['Director', ['director']],
    ['Producer', ['producer']],
    ['Writer', ['screenwriter']],
    ['Music', ['composer']],
    ['Release', ['publication date', 'release date']],
    ['Country', ['country of origin']],
    ['Language', ['original language']],
    ['Runtime', ['duration']],
    ['Budget', ['production budget', 'budget']],
    ['Box Office', ['box office']],
  ]
  const detailCards = detailLabels
    .map(([label, keys]) => detailFromFacts(facts, keys, label))
    .filter((c): c is WorkDetailCard => c !== null && c.value !== '—')

  const aiTimeline =
    dossier.aiProfile?.timeline.map((t) => ({
      year: t.year,
      label: t.label,
      detail: t.detail,
    })) ?? []

  const baseTimeline: Milestone[] = []
  if (released) {
    baseTimeline.push({ year, label: 'Released', detail: released })
  }
  if (budget) baseTimeline.push({ label: 'Production budget', detail: budget })
  if (boxOffice) baseTimeline.push({ label: 'Box office', detail: boxOffice })
  for (const m of dossier.life.timeline.slice(0, 4)) {
    if (!baseTimeline.some((t) => t.label === m.label)) baseTimeline.push(m)
  }

  const timeline =
    aiTimeline.length >= 3 ? aiTimeline : enrichSparseTimeline(dossier, baseTimeline)

  return {
    genreTags,
    heroMetrics: heroMetrics.slice(0, 4),
    highlights: highlights.slice(0, 4),
    keyStats,
    cast,
    detailCards: detailCards.slice(0, 9),
    genres,
    timeline: timeline.slice(0, 8),
    imdbRating,
  }
}
