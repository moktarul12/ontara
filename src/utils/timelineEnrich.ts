import type { EntityDossier, Milestone, VerifiedFact } from '../types/entityDossier'
import type { EntityKind } from '../types/entityArticle'

function yearFrom(raw?: string): string | undefined {
  if (!raw) return undefined
  return raw.match(/([+-]?\d{4})/)?.[1]?.replace(/^\+/, '')
}

function factValues(facts: VerifiedFact[], ...labels: string[]): string[] {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  return facts
    .filter((f) => want.has(f.label.toLowerCase()))
    .flatMap((f) => f.values ?? [f.value])
}

function addUnique(items: Milestone[], seen: Set<string>, m: Milestone) {
  const key = `${m.year ?? ''}|${m.label}|${m.detail ?? ''}`.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  items.push(m)
}

/** Expand a sparse timeline with career eras, story beats, and dated facts. */
export function enrichSparseTimeline(
  dossier: EntityDossier,
  base: Milestone[],
  minItems = 4,
): Milestone[] {
  if (base.length >= minItems) return base

  const items = [...base]
  const seen = new Set(items.map((m) => `${m.year ?? ''}|${m.label}|${m.detail ?? ''}`.toLowerCase()))
  const facts = dossier.summary.verifiedFacts

  for (const era of dossier.summary.careerEras) {
    addUnique(items, seen, {
      year: yearFrom(era.era),
      label: era.title,
      detail: era.description ?? era.era,
    })
  }

  for (const beat of dossier.summary.storyBeats) {
    const yr = beat.detail.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1]
    addUnique(items, seen, {
      year: yr,
      label: beat.label,
      detail: beat.detail,
    })
  }

  for (const w of dossier.summary.topWorks) {
    if (!w.year) continue
    addUnique(items, seen, {
      year: w.year,
      label: w.title,
      detail: w.role ? `Notable as ${w.role}` : 'Major work',
    })
  }

  for (const a of dossier.summary.topAwards) {
    addUnique(items, seen, {
      year: a.year,
      label: a.name,
      detail: a.result === 'won' ? 'Honoured with this award' : 'Nominated',
    })
  }

  addDatedFacts(items, seen, facts, dossier.kind, dossier.label)

  for (const section of dossier.wikipedia?.sections ?? []) {
    const yr = section.title.match(/\b(1[0-9]{3}|20[0-9]{2})\b/)?.[1]
    if (yr || /early|career|history|life|found/i.test(section.title)) {
      const detail = section.paragraphs?.[0]
        ? section.paragraphs[0].slice(0, 120).replace(/\s+\S*$/, '…')
        : undefined
      addUnique(items, seen, {
        year: yr,
        label: section.title,
        detail,
      })
    }
    if (items.length >= minItems) break
  }

  return items
    .sort((a, b) => parseInt(a.year ?? '9999', 10) - parseInt(b.year ?? '9999', 10))
    .slice(0, 12)
}

function addDatedFacts(
  items: Milestone[],
  seen: Set<string>,
  facts: VerifiedFact[],
  kind: EntityKind,
  label: string,
) {
  const dateLabels =
    kind === 'person'
      ? ['date of birth', 'date of death', 'educated at']
      : kind === 'org'
        ? ['inception', 'founded', 'company milestone']
        : ['publication date', 'release date', 'premiere date']

  for (const dl of dateLabels) {
    const vals = factValues(facts, dl)
    for (const v of vals) {
      const yr = yearFrom(v)
      addUnique(items, seen, {
        year: yr,
        label: dl === 'date of birth' ? 'Born' : dl === 'date of death' ? 'Died' : formatFactLabel(dl),
        detail: v,
      })
    }
  }

  if (kind === 'org') {
    const hq = factValues(facts, 'headquarters', 'headquarters location')[0]
    if (hq) addUnique(items, seen, { label: 'Headquarters', detail: hq })
    const ceo = factValues(facts, 'chief executive officer')[0]
    if (ceo) addUnique(items, seen, { label: 'Leadership', detail: `Led by ${ceo}` })
  }

  if (kind === 'work') {
    const director = factValues(facts, 'director')[0]
    if (director) addUnique(items, seen, { label: 'Direction', detail: director })
  }
}

function formatFactLabel(key: string): string {
  return key
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** One-sentence editorial intro when the timeline is thin but present. */
export function timelineNarrativeIntro(dossier: EntityDossier, items: Milestone[]): string | undefined {
  if (!items.length) return undefined
  const years = items.map((m) => m.year).filter(Boolean) as string[]
  const span =
    years.length >= 2
      ? `from ${years[0]} through ${years[years.length - 1]}`
      : years[0]
        ? `beginning around ${years[0]}`
        : 'across several chapters'

  if (dossier.kind === 'person') {
    return `${dossier.label}'s life and career unfold ${span}, shaped by the milestones below.`
  }
  if (dossier.kind === 'org') {
    return `${dossier.label} grew ${span}, with founding moments, leadership shifts, and market milestones along the way.`
  }
  if (dossier.kind === 'work') {
    return `From first release to lasting impact, here is how ${dossier.label} took shape ${span}.`
  }
  return `A concise chronology of ${dossier.label} ${span}.`
}
