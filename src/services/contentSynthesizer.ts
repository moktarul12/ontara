import type { EntityKind } from '../types/entityArticle'
import type { VerifiedFact } from '../types/entityDossier'
import {
  formatEmployees,
  formatFactDisplay,
  formatRevenue,
  pickCeoNames,
  pickTopNumeric,
} from '../utils/factFormatter'

function pick(facts: VerifiedFact[], ...labels: string[]): string | undefined {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hit = facts.find((f) => want.has(f.label.toLowerCase()))
  if (!hit) return undefined
  return formatFactDisplay(hit.label, hit.values ?? [hit.value]).display
}

function allValues(facts: VerifiedFact[], ...labels: string[]): string[] {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const hits = facts.filter((f) => want.has(f.label.toLowerCase()))
  return hits.flatMap((f) => f.values ?? [f.value])
}

/** AI-style editorial copy synthesized from verified, formatted facts. */
export function synthesizeNarrative(
  label: string,
  kind: EntityKind,
  facts: VerifiedFact[],
): string | undefined {
  if (kind === 'org') return synthesizeOrgNarrative(label, facts)
  if (kind === 'work') return synthesizeWorkNarrative(label, facts)
  if (kind === 'person') return synthesizePersonNarrative(label, facts)
  if (kind === 'place') return synthesizePlaceNarrative(label, facts)
  return synthesizeGenericNarrative(label, facts)
}

function synthesizeOrgNarrative(label: string, facts: VerifiedFact[]): string | undefined {
  const industry = pick(facts, 'industry')
  const hq = pick(facts, 'headquarters', 'headquarters location')
  const country = pick(facts, 'country', 'country of origin')
  const founded = pick(facts, 'inception', 'founded')
  const ceo = formatFactDisplay(
    'CEO',
    pickCeoNames(allValues(facts, 'chief executive officer', 'CEO')),
  ).display
  const employeesRaw = pickTopNumeric(allValues(facts, 'employees'), 1)[0]
  const revenueRaw = pickTopNumeric(allValues(facts, 'revenue'), 1)[0]

  const parts: string[] = []
  parts.push(
    `${label} is${industry ? ` a major player in ${industry.toLowerCase()}` : ' a notable organization'}${country ? `, rooted in ${country}` : ''}.`,
  )
  if (hq) parts.push(`Its headquarters are in ${hq}.`)
  if (founded) parts.push(`The company traces its origins to ${founded}.`)
  if (ceo && ceo !== '—') parts.push(`Today it is led by ${ceo}.`)
  if (employeesRaw) {
    parts.push(`The workforce numbers roughly ${formatEmployees(employeesRaw)} people worldwide.`)
  }
  if (revenueRaw) {
    parts.push(`Reported revenue stands at about ${formatRevenue(revenueRaw)}.`)
  }

  return parts.join(' ')
}

function synthesizeWorkNarrative(label: string, facts: VerifiedFact[]): string | undefined {
  const director = pick(facts, 'director')
  const genre = allValues(facts, 'genre').slice(0, 3).join(', ')
  const released = pick(facts, 'publication date', 'release date')
  const country = pick(facts, 'country of origin')
  const language = pick(facts, 'original language')
  const cast = allValues(facts, 'cast member').slice(0, 3).join(', ')
  const composer = pick(facts, 'composer')
  const budget = pick(facts, 'production budget', 'budget')
  const boxOffice = pick(facts, 'box office')

  const parts: string[] = []
  let opener = label
  if (released) opener += ` (${released})`
  if (genre) opener += ` is a ${genre.toLowerCase()}`
  else opener += ' is a landmark film'
  if (country) opener += ` from ${country}`
  opener += '.'
  parts.push(opener)
  if (director) parts.push(`Directed by ${director}.`)
  if (cast) parts.push(`It stars ${cast}.`)
  if (language) parts.push(`The film is in ${language}.`)
  if (composer) parts.push(`Music by ${composer}.`)
  if (budget) parts.push(`Made on a budget of ${budget}.`)
  if (boxOffice) parts.push(`It earned ${boxOffice} at the box office.`)

  return parts.join(' ')
}

function synthesizePersonNarrative(label: string, facts: VerifiedFact[]): string | undefined {
  const occ = allValues(facts, 'occupation').slice(0, 2).join(' and ')
  const country = pick(facts, 'country of citizenship')
  const born = pick(facts, 'date of birth')
  const award = pick(facts, 'award received')

  let text = label
  if (occ) text += ` is known as ${occ}`
  if (country) text += ` from ${country}`
  text += '.'
  if (born) text += ` Born ${born}.`
  if (award) text += ` Among their honours: ${award}.`
  return text
}

function synthesizePlaceNarrative(label: string, facts: VerifiedFact[]): string {
  const country = pick(facts, 'country', 'located in the administrative territorial entity')
  const type = pick(facts, 'instance of')
  const population = pick(facts, 'population')
  const area = pick(facts, 'area')

  const parts: string[] = []
  parts.push(
    `${label} is${type ? ` a ${type.toLowerCase()}` : ' a notable place'}${country ? ` in ${country}` : ''}.`,
  )
  if (population) parts.push(`Population is recorded at roughly ${population}.`)
  if (area) parts.push(`It covers about ${area}.`)
  return parts.join(' ')
}

function synthesizeGenericNarrative(label: string, facts: VerifiedFact[]): string {
  const type = pick(facts, 'instance of')
  const description = pick(facts, 'description')
  if (type) return `${label} is classified as ${type.toLowerCase()} in structured knowledge bases.`
  if (description) return `${label} — ${description}.`
  if (facts.length) {
    const top = facts.slice(0, 2).map((f) => `${f.label.toLowerCase()}: ${f.value}`)
    return `${label} is documented with ${top.join('; ')}.`
  }
  return `${label} is a topic covered across Wikidata and related reference sources.`
}

export function synthesizeCareerBrief(
  kind: EntityKind,
  facts: VerifiedFact[],
): string | undefined {
  if (kind !== 'org') return undefined
  const ceo = formatFactDisplay('CEO', pickCeoNames(allValues(facts, 'chief executive officer'))).display
  const revenue = pickTopNumeric(allValues(facts, 'revenue'), 1)[0]
  const employees = pickTopNumeric(allValues(facts, 'employees'), 1)[0]
  const bits: string[] = []
  if (ceo && ceo !== '—') bits.push(`Leadership: ${ceo}`)
  if (employees) bits.push(`~${formatEmployees(employees)} employees`)
  if (revenue) bits.push(`${formatRevenue(revenue)} revenue`)
  return bits.length ? bits.join(' · ') : undefined
}
