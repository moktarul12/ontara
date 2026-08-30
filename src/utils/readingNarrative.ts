import type { EntityKind } from '../types/entityArticle'
import type { VerifiedFact } from '../types/entityDossier'

function pick(facts: VerifiedFact[], ...labels: string[]): string | undefined {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hit = facts.find((f) => want.has(f.label.toLowerCase()))
  return hit?.values?.slice(0, 3).join(', ') ?? hit?.value
}

function yearFrom(raw?: string): string | undefined {
  if (!raw) return undefined
  return raw.match(/([+-]?\d{4})/)?.[1]?.replace(/^\+/, '')
}

function joinNatural(items: string[], max = 3): string {
  const list = items.filter(Boolean).slice(0, max)
  if (!list.length) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

/** One engaging sentence that hooks the reader — kind-aware, built from verified facts. */
export function buildReadingHook(
  label: string,
  kind: EntityKind,
  facts: VerifiedFact[],
): string | undefined {
  if (kind === 'work') {
    const year = yearFrom(pick(facts, 'publication date', 'release date'))
    const genre = pick(facts, 'genre')
    const director = pick(facts, 'director')
    const cast = facts
      .filter((f) => f.label.toLowerCase() === 'cast member')
      .flatMap((f) => f.values ?? [f.value])
      .slice(0, 3)
    const country = pick(facts, 'country of origin')

    const parts: string[] = []
    if (year) parts.push(`Released in ${year}`)
    if (genre) parts.push(`a ${genre.toLowerCase()} film`)
    if (country) parts.push(`from ${country}`)
    let hook = parts.length ? `${label} is ${parts.join(', ')}.` : `${label} is a creative work worth knowing.`
    if (director) hook += ` Directed by ${director}.`
    if (cast.length) hook += ` It stars ${joinNatural(cast)}.`
    return hook
  }

  if (kind === 'org') {
    const industry = pick(facts, 'industry')
    const founded = yearFrom(pick(facts, 'inception', 'founded'))
    const hq = pick(facts, 'headquarters', 'headquarters location')
    const ceo = pick(facts, 'chief executive officer')
    const country = pick(facts, 'country', 'country of origin')

    let hook = `${label}`
    if (industry) hook += ` operates in ${industry.toLowerCase()}`
    if (country) hook += `, rooted in ${country}`
    hook += '.'
    if (founded) hook += ` Founded in ${founded}.`
    if (hq) hook += ` Headquarters: ${hq}.`
    if (ceo) hook += ` Led by ${ceo}.`
    return hook
  }

  if (kind === 'person') {
    const occ = facts
      .filter((f) => f.label.toLowerCase() === 'occupation')
      .flatMap((f) => f.values ?? [f.value])
      .slice(0, 2)
    const country = pick(facts, 'country of citizenship')
    const born = yearFrom(pick(facts, 'date of birth'))
    const known = pick(facts, 'notable work', 'award received')

    let hook = label
    if (occ.length) hook += ` is ${joinNatural(occ)}`
    if (country) hook += ` from ${country}`
    hook += '.'
    if (born) hook += ` Born ${born}.`
    if (known) hook += ` Notable for ${known}.`
    return hook
  }

  if (kind === 'place') {
    const country = pick(facts, 'country', 'located in the administrative territorial entity')
    const type = pick(facts, 'instance of')
    return type
      ? `${label} is a ${type.toLowerCase()}${country ? ` in ${country}` : ''}.`
      : `${label} is a documented place${country ? ` in ${country}` : ''}.`
  }

  const type = pick(facts, 'instance of')
  return type ? `${label} — ${type}.` : `${label} is covered across reference sources.`
}

/** Short editorial paragraph weaving confirmed facts into readable prose. */
export function buildStoryParagraph(
  label: string,
  kind: EntityKind,
  facts: VerifiedFact[],
  aboutTeaser?: string,
): string | undefined {
  const confirmed = facts.filter((f) => f.status === 'confirmed')
  const hook = buildReadingHook(label, kind, facts)
  if (!hook && !aboutTeaser) return undefined

  const extras: string[] = []
  if (kind === 'work') {
    const awards = facts
      .filter((f) => f.label.toLowerCase() === 'award received')
      .flatMap((f) => f.values ?? [f.value])
    if (awards.length) extras.push(`Honoured with ${joinNatural(awards, 2)}.`)
    const lang = pick(facts, 'original language')
    if (lang) extras.push(`Originally in ${lang}.`)
  }

  if (kind === 'person' && confirmed.length >= 2) {
    const awards = pick(facts, 'award received')
    if (awards) extras.push(`Recognised with awards including ${awards}.`)
  }

  const body = [hook, ...extras].filter(Boolean).join(' ')
  if (aboutTeaser && !body.includes(aboutTeaser.slice(0, 40))) {
    return `${body} ${aboutTeaser}`.trim()
  }
  return body || aboutTeaser
}

export function verifiedTrivia(
  facts: VerifiedFact[],
  description?: string,
): string | undefined {
  if (!description || description.length < 40 || description.length > 220) return undefined
  const confirmed = facts.filter((f) => f.status === 'confirmed')
  if (confirmed.length < 2) return undefined
  return description
}
