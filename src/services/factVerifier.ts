import type { EntityProfile, ProfileFact } from './entityProfile'
import type { FactSource, SourceTrust, VerifiedFact } from '../types/entityDossier'
import { formatFactDisplay, isRawQid } from '../utils/factFormatter'

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function valueInCorpus(value: string, corpus: string): boolean {
  const v = norm(value)
  if (v.length < 2) return false
  const c = norm(corpus)
  if (c.includes(v)) return true

  const year = v.match(/([+-]?\d{4})/)?.[1]?.replace(/^\+/, '')
  if (year && c.includes(year)) return true

  const words = v.split(/[\s,]+/).filter((w) => w.length > 3)
  if (words.length >= 2) {
    const hits = words.filter((w) => c.includes(w.toLowerCase()))
    if (hits.length >= Math.min(2, words.length)) return true
  } else if (words.length === 1 && c.includes(words[0].toLowerCase())) {
    return true
  }

  return false
}

function sourcesForValue(
  fact: ProfileFact,
  wikiText?: string,
  dbpediaText?: string,
): FactSource[] {
  const sources = new Set<FactSource>()
  sources.add(fact.source === 'dbpedia' ? 'dbpedia' : fact.source === 'yago' ? 'wikidata' : fact.source)

  if (wikiText && valueInCorpus(fact.value, wikiText)) sources.add('wikipedia')
  if (dbpediaText && valueInCorpus(fact.value, dbpediaText)) sources.add('dbpedia')

  return [...sources]
}

const PRIORITY_LABELS = [
  'director',
  'cast member',
  'genre',
  'publication date',
  'release date',
  'country of origin',
  'occupation',
  'date of birth',
  'place of birth',
  'country of citizenship',
  'industry',
  'inception',
  'headquarters',
  'chief executive officer',
  'employees',
  'revenue',
  'ticker symbol',
  'stock exchange',
  'net profit',
  'market capitalization',
  'award received',
  'screenwriter',
  'producer',
  'production company',
  'original language',
]

function labelPriority(label: string): number {
  const i = PRIORITY_LABELS.indexOf(label.toLowerCase())
  return i >= 0 ? i : 100
}

/** Cross-check Wikidata facts against Wikipedia + DBpedia prose. */
export function verifyProfileFacts(
  profile: EntityProfile,
  wikiText?: string,
  dbpediaText?: string,
): { facts: VerifiedFact[]; trust: SourceTrust } {
  const byLabel = new Map<string, { values: string[]; sources: Set<FactSource> }>()

  for (const fact of profile.facts) {
    const label = fact.predicateLabel
    const key = label.toLowerCase()
    if (isRawQid(fact.value)) continue
    const entry = byLabel.get(key) ?? { values: [], sources: new Set<FactSource>() }
    if (!entry.values.includes(fact.value)) entry.values.push(fact.value)
    for (const s of sourcesForValue(fact, wikiText, dbpediaText)) entry.sources.add(s)
    byLabel.set(key, entry)
  }

  const facts: VerifiedFact[] = []
  let confirmedCount = 0
  let reportedCount = 0

  for (const [key, entry] of byLabel) {
    const label = profile.facts.find((f) => f.predicateLabel.toLowerCase() === key)?.predicateLabel ?? key
    const sources = [...entry.sources]
    const status = sources.length >= 2 ? 'confirmed' : 'reported'
    if (status === 'confirmed') confirmedCount++
    else reportedCount++

    const formatted = formatFactDisplay(label, entry.values)
    const singleValue =
      /revenue|employees|industry|website|official|net profit|market cap|genre|cast|budget|box office|duration|review/i.test(
        formatted.label,
      )
    facts.push({
      label: formatted.label,
      value: formatted.display,
      values: singleValue ? undefined : formatted.values,
      sources,
      status,
    })
  }

  facts.sort((a, b) => labelPriority(a.label) - labelPriority(b.label))

  const activeSources = new Set<FactSource>()
  if (profile.sourcesUsed.includes('wikidata')) activeSources.add('wikidata')
  if (wikiText?.trim()) activeSources.add('wikipedia')
  if (dbpediaText?.trim()) activeSources.add('dbpedia')

  return {
    facts: facts.slice(0, 16),
    trust: {
      sources: [...activeSources],
      confirmedCount,
      reportedCount,
      totalFacts: facts.length,
    },
  }
}
