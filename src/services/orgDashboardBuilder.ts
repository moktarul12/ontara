import type { EntityDossier, HeroMetric, Milestone, VerifiedFact } from '../types/entityDossier'
import {
  formatFactDisplay,
  formatRevenue,
  parseNumeric,
  pickCeoNames,
  pickTopNumeric,
} from '../utils/factFormatter'
import { enrichSparseTimeline } from '../utils/timelineEnrich'

export type OrgHighlight = {
  label: string
  value: string
  hint?: string
}

export type OrgFinancialPoint = {
  label: string
  display: string
  pct: number
}

export type OrgKeyPerson = {
  name: string
  role: string
}

export type OrgProduct = {
  name: string
}

export type OrgDashboardData = {
  typeTags: string[]
  heroMetrics: HeroMetric[]
  highlights: OrgHighlight[]
  financialPoints: OrgFinancialPoint[]
  keyPeople: OrgKeyPerson[]
  products: OrgProduct[]
  timeline: Milestone[]
  ticker?: string
  exchange?: string
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

function buildOrgTimeline(dossier: EntityDossier, facts: VerifiedFact[]): Milestone[] {
  const items: Milestone[] = []
  const seen = new Set<string>()

  const add = (m: Milestone) => {
    const key = `${m.year ?? ''}|${m.label}|${m.detail ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(m)
  }

  for (const raw of factValues(facts, 'company milestone')) {
    const match = raw.match(/^(\d{4})\|(.+)$/)
    if (match) add({ year: match[1], label: match[2] })
  }

  const founded = factDisplay(facts, 'inception', 'founded')
  if (founded) {
    add({
      year: founded.match(/\d{4}/)?.[0],
      label: 'Company founded',
      detail: founded,
    })
  }

  const founders = factValues(facts, 'founded by')
  if (founders.length) {
    add({
      year: founded?.match(/\d{4}/)?.[0],
      label: 'Founded by',
      detail: founders.slice(0, 4).join(', '),
    })
  }

  for (const m of dossier.life.timeline) add(m)

  for (const a of dossier.awards.won) {
    if (a.year) add({ year: a.year, label: 'Award received', detail: a.name })
  }

  const exchange = factValues(facts, 'stock exchange')[0]
  const ticker = factValues(facts, 'ticker symbol')[0]
  if (exchange) {
    add({
      label: 'Public listing',
      detail: ticker ? `${exchange} (${ticker})` : exchange,
    })
  }

  const hq = factDisplay(facts, 'headquarters', 'headquarters location')
  if (hq) add({ label: 'Headquarters', detail: hq })

  return items
    .sort((a, b) => parseInt(a.year ?? '9999', 10) - parseInt(b.year ?? '9999', 10))
    .slice(0, 16)
}

export function buildOrgDashboardData(dossier: EntityDossier): OrgDashboardData {
  const facts = dossier.summary.verifiedFacts
  const typeTags = factValues(facts, 'instance of').slice(0, 3)

  const founded = factDisplay(facts, 'inception', 'founded')
  const revenue = factDisplay(facts, 'revenue')
  const employees = factDisplay(facts, 'employees')
  const netIncome = factDisplay(facts, 'net profit')
  const marketCap = factDisplay(facts, 'market capitalization')
  const ticker = factValues(facts, 'ticker symbol')[0]
  const exchange = factValues(facts, 'stock exchange')[0]

  const heroMetrics: HeroMetric[] = []
  if (founded) heroMetrics.push({ label: 'Founded', value: founded, icon: 'years' })
  if (revenue) heroMetrics.push({ label: 'Revenue', value: revenue, icon: 'award' })
  if (netIncome) heroMetrics.push({ label: 'Net Income', value: netIncome, icon: 'star' })
  if (marketCap) heroMetrics.push({ label: 'Market Cap', value: marketCap, icon: 'film' })
  if (ticker) heroMetrics.push({ label: 'Ticker', value: ticker, icon: 'years' })
  if (!heroMetrics.length) heroMetrics.push(...dossier.hero.metrics)

  const industry = factValues(facts, 'industry').slice(0, 2).join(' · ')
  const hq = factDisplay(facts, 'headquarters', 'headquarters location')
  const country = factDisplay(facts, 'country', 'country of origin')

  const highlights: OrgHighlight[] = []
  if (industry) highlights.push({ label: 'Industry', value: industry.split(' · ')[0], hint: industry })
  if (employees) highlights.push({ label: 'Workforce', value: employees, hint: 'Global employees' })
  if (revenue) highlights.push({ label: 'Revenue', value: revenue, hint: 'Latest reported' })
  if (country || hq) {
    highlights.push({
      label: 'Headquarters',
      value: hq ?? country ?? '—',
      hint: country && hq ? country : undefined,
    })
  }
  if (dossier.awards.won.length) {
    highlights.push({
      label: 'Honours',
      value: String(dossier.awards.won.length),
      hint: 'Awards received',
    })
  }

  const revenueRaw = pickTopNumeric(factValues(facts, 'revenue'), 5)
    .map((v) => ({ v, n: parseNumeric(v) ?? 0 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => a.n - b.n)
  const maxRev = revenueRaw[revenueRaw.length - 1]?.n ?? 1
  const financialPoints: OrgFinancialPoint[] = revenueRaw.map((r, i) => ({
    label: revenueRaw.length > 1 ? `Period ${i + 1}` : 'Latest',
    display: formatRevenue(r.v),
    pct: Math.max(12, Math.round((r.n / maxRev) * 100)),
  }))

  const ceos = pickCeoNames(factValues(facts, 'chief executive officer', 'CEO'))
  const keyPeople: OrgKeyPerson[] = ceos.map((name) => ({ name, role: 'Chief Executive Officer' }))

  const products = [
    ...factValues(facts, 'product or material produced'),
    ...factValues(facts, 'owner of'),
    ...dossier.works.items.map((w) => w.title),
  ]
    .filter(Boolean)
    .filter((p, i, arr) => arr.findIndex((x) => x.toLowerCase() === p.toLowerCase()) === i)
    .slice(0, 6)
    .map((name) => ({ name }))

  const aiTimeline =
    dossier.aiProfile?.timeline.map((t) => ({
      year: t.year,
      label: t.label,
      detail: t.detail,
    })) ?? []

  const timeline =
    aiTimeline.length >= 4
      ? aiTimeline
      : enrichSparseTimeline(dossier, buildOrgTimeline(dossier, facts))

  return {
    typeTags,
    heroMetrics: heroMetrics.slice(0, 5),
    highlights: highlights.slice(0, 4),
    financialPoints,
    keyPeople,
    products,
    timeline,
    ticker,
    exchange,
  }
}
