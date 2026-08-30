import type { ProfileFact, ProfileFactGroup } from '../services/entityProfile'

export type PredicateGroup = {
  predicateLabel: string
  values: ProfileFact[]
}

export const PROFILE_GROUP_BLURBS: Record<ProfileFactGroup, string> = {
  identity: 'Nationality, classification, languages, and personal identity.',
  life: 'Birth, death, and key life events.',
  career: 'Profession, education, creative work, politics, and business roles.',
  family: 'Parents, partners, children, and relatives.',
  awards: 'Honors, prizes, and nominations.',
  links: 'Official and external references.',
  other: 'Additional facts merged from linked knowledge bases.',
}

function valuesFor(facts: ProfileFact[], ...labels: string[]): string[] {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const out: string[] = []
  const seen = new Set<string>()
  for (const f of facts) {
    if (!want.has(f.predicateLabel.toLowerCase())) continue
    const key = f.value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(f.value.trim())
  }
  return out
}

export function joinPhrase(items: string[], max = 10): string {
  const list = items.slice(0, max)
  if (!list.length) return ''
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} and ${list[1]}`
  return `${list.slice(0, -1).join(', ')}, and ${list[list.length - 1]}`
}

function sentence(parts: string[]): string {
  const text = parts.filter(Boolean).join(' ')
  if (!text) return ''
  return text.endsWith('.') ? text : `${text}.`
}

/** Turn grouped facts into a readable paragraph for each category. */
export function buildGroupNarrative(
  group: ProfileFactGroup,
  facts: ProfileFact[],
  subjectLabel: string,
): string {
  const name = subjectLabel.trim() || 'This entity'

  switch (group) {
    case 'identity': {
      const types = valuesFor(facts, 'instance of')
      const citizenship = valuesFor(facts, 'country of citizenship')
      const languages = valuesFor(facts, 'languages spoken', 'native language')
      const gender = valuesFor(facts, 'sex or gender')
      const birthName = valuesFor(facts, 'birth name', 'given name', 'family name')
      return sentence([
        types.length ? `${name} is ${joinPhrase(types)}` : '',
        citizenship.length ? `Citizen of ${joinPhrase(citizenship)}` : '',
        birthName.length ? `Also known as ${joinPhrase(birthName)}` : '',
        gender.length ? `Gender: ${joinPhrase(gender)}` : '',
        languages.length ? `Speaks ${joinPhrase(languages)}` : '',
      ])
    }
    case 'life': {
      const dob = valuesFor(facts, 'date of birth')
      const birth = valuesFor(facts, 'place of birth')
      const dod = valuesFor(facts, 'date of death')
      const death = valuesFor(facts, 'place of death')
      const born =
        dob.length || birth.length
          ? `Born${dob.length ? ` ${joinPhrase(dob, 1)}` : ''}${birth.length ? ` in ${joinPhrase(birth)}` : ''}`
          : ''
      const died =
        dod.length || death.length
          ? `Died${dod.length ? ` ${joinPhrase(dod, 1)}` : ''}${death.length ? ` in ${joinPhrase(death)}` : ''}`
          : ''
      return sentence([born, died])
    }
    case 'career': {
      const occupations = valuesFor(facts, 'occupation')
      const employers = valuesFor(facts, 'employer')
      const schools = valuesFor(facts, 'educated at')
      const fields = valuesFor(facts, 'field of work')
      const genres = valuesFor(facts, 'genre')
      const works = valuesFor(facts, 'notable work', 'cast in', 'directed', 'screenplay by')
      const parties = valuesFor(facts, 'political party')
      const offices = valuesFor(facts, 'position held')
      const founded = valuesFor(facts, 'founded', 'owner of', 'owns', 'board member of')
      return sentence([
        occupations.length ? `${name} is known as ${joinPhrase(occupations)}` : '',
        employers.length ? `Employed by ${joinPhrase(employers)}` : '',
        schools.length ? `Educated at ${joinPhrase(schools)}` : '',
        fields.length ? `Field of work: ${joinPhrase(fields)}` : '',
        genres.length ? `Associated with ${joinPhrase(genres)}` : '',
        works.length ? `Notable work includes ${joinPhrase(works, 8)}` : '',
        parties.length ? `Affiliated with ${joinPhrase(parties)}` : '',
        offices.length ? `Held office as ${joinPhrase(offices, 6)}` : '',
        founded.length ? `Business roles include ${joinPhrase(founded, 6)}` : '',
      ])
    }
    case 'family': {
      const father = valuesFor(facts, 'father')
      const mother = valuesFor(facts, 'mother')
      const spouse = valuesFor(facts, 'spouse', 'unmarried partner')
      const children = valuesFor(facts, 'child')
      const siblings = valuesFor(facts, 'sibling')
      const relatives = valuesFor(facts, 'relative')
      return sentence([
        father.length || mother.length
          ? `Parents: ${joinPhrase([...father, ...mother])}`
          : '',
        spouse.length ? `Partner${spouse.length > 1 ? 's' : ''}: ${joinPhrase(spouse)}` : '',
        children.length ? `Children include ${joinPhrase(children, 8)}` : '',
        siblings.length ? `Sibling${siblings.length > 1 ? 's' : ''}: ${joinPhrase(siblings, 8)}` : '',
        relatives.length ? `Other relatives: ${joinPhrase(relatives, 8)}` : '',
      ])
    }
    case 'awards': {
      const awards = valuesFor(facts, 'award received')
      const nominations = valuesFor(facts, 'nominated for')
      return sentence([
        awards.length ? `${name} received ${joinPhrase(awards, 8)}` : '',
        nominations.length ? `Nominated for ${joinPhrase(nominations, 8)}` : '',
      ])
    }
    case 'links': {
      const sites = valuesFor(facts, 'official website')
      return sentence(sites.length ? [`Official website: ${joinPhrase(sites, 3)}`] : [])
    }
    case 'other': {
      const sample = facts.slice(0, 6).map((f) => `${f.predicateLabel}: ${f.value}`)
      return sample.length
        ? `${name} has additional recorded facts such as ${joinPhrase(sample, 4)}.`
        : ''
    }
    default:
      return ''
  }
}

/** Group facts by predicate label for structured display. */
export function groupFactsByPredicate(facts: ProfileFact[]): PredicateGroup[] {
  const map = new Map<string, ProfileFact[]>()
  for (const f of facts) {
    const key = f.predicateLabel.trim() || 'Fact'
    const list = map.get(key) ?? []
    const dup = list.some((x) => x.value.trim().toLowerCase() === f.value.trim().toLowerCase())
    if (!dup) list.push(f)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([predicateLabel, values]) => ({ predicateLabel, values }))
    .sort((a, b) => a.predicateLabel.localeCompare(b.predicateLabel))
}

/** Pick the best long-form summary from available text sources. */
export function pickLongSummary(
  wikidataDesc?: string,
  dbpediaAbstract?: string,
  maxLen = 1200,
): string | undefined {
  const candidates = [dbpediaAbstract, wikidataDesc].filter(Boolean) as string[]
  if (!candidates.length) return undefined
  const best = candidates.sort((a, b) => b.length - a.length)[0]
  const trimmed = best.trim()
  if (trimmed.length <= maxLen) return trimmed
  const cut = trimmed.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 400 ? lastSpace : maxLen)}…`
}
