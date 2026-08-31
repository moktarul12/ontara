import type { ProfileFact } from './entityProfile'

const PERSON_P31 = new Set(['Q5'])

const ORG_P31 = new Set([
  'Q43229',
  'Q4830453',
  'Q783794',
  'Q6881511',
  'Q891723',
  'Q161726',
  'Q783794',
  'Q4830453',
])

const WORK_P31 = new Set([
  'Q11424',
  'Q24856',
  'Q5398426',
  'Q15416',
  'Q21191270',
  'Q2431196',
  'Q229390',
  'Q506240',
  'Q1364726',
  'Q134556',
  'Q7366',
  'Q482994',
  'Q208569',
  'Q222910',
  'Q105543609',
  'Q2188189',
  'Q7889',
  'Q571',
  'Q7725634',
])

export type CuratedEntityKind = 'person' | 'org' | 'work' | 'other'

/** Classify from Wikidata P31 (instance of) Q-ids. */
export function classifyKindFromP31(ids: string[]): CuratedEntityKind {
  if (ids.some((id) => PERSON_P31.has(id))) return 'person'
  if (ids.some((id) => ORG_P31.has(id))) return 'org'
  if (ids.some((id) => WORK_P31.has(id))) return 'work'
  return 'other'
}

/** Fallback when P31 classification is missing — uses loaded facts + description. */
export function inferKindFromFacts(
  facts: ProfileFact[],
  description?: string,
): CuratedEntityKind {
  const labels = new Set(facts.map((f) => f.predicateLabel.toLowerCase()))
  const desc = description?.toLowerCase() ?? ''

  if (labels.has('director') || labels.has('cast member') || labels.has('screenwriter')) {
    if (desc.includes('film') || desc.includes('movie') || desc.includes('television') || labels.has('director')) {
      return 'work'
    }
  }
  if (/\bfilm\b|\bmovie\b|\btelevision (series|program)\b|\balbum\b|\bvideo game\b/.test(desc)) {
    return 'work'
  }
  if (labels.has('chief executive officer') || labels.has('industry') || labels.has('inception')) {
    if (!labels.has('date of birth')) return 'org'
  }
  if (labels.has('occupation') || labels.has('date of birth') || labels.has('place of birth')) {
    return 'person'
  }
  return 'other'
}

export function resolveEntityKind(
  p31Ids: string[],
  facts: ProfileFact[],
  description?: string,
): CuratedEntityKind {
  const fromP31 = classifyKindFromP31(p31Ids)
  if (fromP31 !== 'other') return fromP31
  return inferKindFromFacts(facts, description)
}
