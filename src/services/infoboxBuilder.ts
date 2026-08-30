import type { EntityProfile } from './entityProfile'
import type { EntityKind, InfoboxRow } from '../types/entityArticle'

function slug(s: string): string {
  return s.trim().toLowerCase()
}

function row(label: string, values: string[]): InfoboxRow | null {
  const uniq = [...new Set(values.map((v) => v.trim()).filter(Boolean))]
  if (!uniq.length) return null
  return {
    label,
    values: uniq.map((text) => ({ text })),
  }
}

function valuesFor(profile: EntityProfile, ...labels: string[]): string[] {
  const want = new Set(labels.map(slug))
  const out: string[] = []
  const seen = new Set<string>()
  for (const f of profile.facts) {
    if (!want.has(slug(f.predicateLabel))) continue
    const key = f.value.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(f.value.trim())
  }
  return out
}

function bornRow(profile: EntityProfile): InfoboxRow | null {
  const date = valuesFor(profile, 'date of birth')[0]
  const place = valuesFor(profile, 'place of birth')[0]
  if (!date && !place) return null
  const text = [date, place ? `in ${place}` : ''].filter(Boolean).join(' ')
  return { label: 'Born', values: [{ text }] }
}

function personInfobox(profile: EntityProfile): InfoboxRow[] {
  return [
    bornRow(profile),
    row('Died', [
      ...valuesFor(profile, 'date of death').map((d) =>
        valuesFor(profile, 'place of death')[0] ? `${d} in ${valuesFor(profile, 'place of death')[0]}` : d,
      ),
    ]),
    row('Citizenship', valuesFor(profile, 'country of citizenship')),
    row('Occupation', valuesFor(profile, 'occupation')),
    row('Education', valuesFor(profile, 'educated at')),
    row('Spouse', valuesFor(profile, 'spouse', 'unmarried partner')),
    row('Children', valuesFor(profile, 'child')),
    row('Parent(s)', [...valuesFor(profile, 'father'), ...valuesFor(profile, 'mother')]),
    row('Awards', valuesFor(profile, 'award received').slice(0, 6)),
    row('Website', valuesFor(profile, 'official website')),
  ].filter((r): r is InfoboxRow => r !== null)
}

function orgInfobox(profile: EntityProfile): InfoboxRow[] {
  return [
    row('Type', valuesFor(profile, 'instance of')),
    row('Industry', valuesFor(profile, 'industry')),
    row('Founded', valuesFor(profile, 'inception', 'founded')),
    row('Headquarters', valuesFor(profile, 'headquarters', 'headquarters location')),
    row('Country', valuesFor(profile, 'country')),
    row('CEO', valuesFor(profile, 'chief executive officer')),
    row('Employees', valuesFor(profile, 'employees')),
    row('Revenue', valuesFor(profile, 'revenue')),
    row('Website', valuesFor(profile, 'official website')),
  ].filter((r): r is InfoboxRow => r !== null)
}

function workInfobox(profile: EntityProfile): InfoboxRow[] {
  return [
    row('Directed by', valuesFor(profile, 'director')),
    row('Produced by', valuesFor(profile, 'producer')),
    row('Written by', valuesFor(profile, 'screenwriter')),
    row('Starring', valuesFor(profile, 'cast member')),
    row('Release date', valuesFor(profile, 'publication date', 'release date')),
    row('Genre', valuesFor(profile, 'genre')),
    row('Country', valuesFor(profile, 'country of origin')),
    row('Language', valuesFor(profile, 'original language')),
    row('IMDb', valuesFor(profile, 'IMDb ID')),
  ].filter((r): r is InfoboxRow => r !== null)
}

export function buildInfobox(profile: EntityProfile, kind: EntityKind): InfoboxRow[] {
  if (kind === 'person') return personInfobox(profile)
  if (kind === 'org') return orgInfobox(profile)
  if (kind === 'work') return workInfobox(profile)
  return [
    row('Type', profile.classes.slice(0, 3)),
    row('Description', profile.description ? [profile.description] : []),
  ].filter((r): r is InfoboxRow => r !== null)
}
