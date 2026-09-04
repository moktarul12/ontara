import type { ProfileFact, ProfileFactGroup } from './entityProfile'
import type { InfoboxRow } from '../types/entityArticle'
import { classifyKindFromP31, type CuratedEntityKind } from './entityKind'
import { imageUrlFromEntityClaims } from './entityImages'

const WIKIDATA_API = '/api/wikidata'

/** Core Wikidata properties for person/org infobox + article fallback. */
const CLAIM_PROPS: { id: string; label: string; group: ProfileFactGroup }[] = [
  { id: 'P31', label: 'instance of', group: 'identity' },
  { id: 'P27', label: 'country of citizenship', group: 'identity' },
  { id: 'P19', label: 'place of birth', group: 'life' },
  { id: 'P20', label: 'place of death', group: 'life' },
  { id: 'P569', label: 'date of birth', group: 'life' },
  { id: 'P570', label: 'date of death', group: 'life' },
  { id: 'P21', label: 'sex or gender', group: 'identity' },
  { id: 'P1412', label: 'languages spoken', group: 'identity' },
  { id: 'P103', label: 'native language', group: 'identity' },
  { id: 'P106', label: 'occupation', group: 'career' },
  { id: 'P108', label: 'employer', group: 'career' },
  { id: 'P69', label: 'educated at', group: 'career' },
  { id: 'P800', label: 'notable work', group: 'career' },
  { id: 'P166', label: 'award received', group: 'awards' },
  { id: 'P1411', label: 'nominated for', group: 'awards' },
  { id: 'P22', label: 'father', group: 'family' },
  { id: 'P25', label: 'mother', group: 'family' },
  { id: 'P26', label: 'spouse', group: 'family' },
  { id: 'P40', label: 'child', group: 'family' },
  { id: 'P451', label: 'unmarried partner', group: 'family' },
  { id: 'P856', label: 'official website', group: 'links' },
  { id: 'P1477', label: 'birth name', group: 'identity' },
  { id: 'P452', label: 'industry', group: 'career' },
  { id: 'P159', label: 'headquarters', group: 'identity' },
  { id: 'P571', label: 'inception', group: 'life' },
  { id: 'P169', label: 'chief executive officer', group: 'career' },
  { id: 'P57', label: 'director', group: 'career' },
  { id: 'P161', label: 'cast member', group: 'career' },
  { id: 'P577', label: 'publication date', group: 'life' },
  { id: 'P136', label: 'genre', group: 'career' },
  { id: 'P495', label: 'country of origin', group: 'identity' },
  { id: 'P364', label: 'original language', group: 'identity' },
  { id: 'P345', label: 'IMDb ID', group: 'links' },
  { id: 'P58', label: 'screenwriter', group: 'career' },
  { id: 'P162', label: 'producer', group: 'career' },
  { id: 'P86', label: 'composer', group: 'career' },
  { id: 'P272', label: 'production company', group: 'career' },
  { id: 'P2047', label: 'duration', group: 'life' },
  { id: 'P2130', label: 'production budget', group: 'identity' },
  { id: 'P2142', label: 'box office', group: 'identity' },
  { id: 'P444', label: 'review score', group: 'identity' },
  { id: 'P1128', label: 'employees', group: 'identity' },
  { id: 'P2139', label: 'revenue', group: 'identity' },
  { id: 'P17', label: 'country', group: 'identity' },
  { id: 'P249', label: 'ticker symbol', group: 'links' },
  { id: 'P414', label: 'stock exchange', group: 'links' },
  { id: 'P2295', label: 'net profit', group: 'identity' },
  { id: 'P2226', label: 'market capitalization', group: 'identity' },
  { id: 'P1056', label: 'product or material produced', group: 'career' },
  { id: 'P1830', label: 'owner of', group: 'career' },
  { id: 'P793', label: 'significant event', group: 'life' },
  { id: 'P112', label: 'founded by', group: 'life' },
]

export type WbEntity = {
  labels?: Record<string, { value: string }>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, WbClaim[]>
  sitelinks?: Record<string, { title: string }>
}

export type WikidataClaimBundle = {
  facts: ProfileFact[]
  description?: string
  label?: string
  kind?: CuratedEntityKind
  wikipediaTitle?: string
  wikipediaLang?: string
  imageUrl?: string
}

type WbClaim = {
  mainsnak: {
    datavalue?: {
      type: string
      value: unknown
    }
  }
  qualifiers?: Record<
    string,
    {
      mainsnak: {
        datavalue?: {
          type: string
          value: unknown
        }
      }
    }[]
  >
}

function qidFromUri(uri: string): string | null {
  const m = uri.match(/\/(Q\d+)$/i) || uri.match(/(Q\d+)/i)
  return m ? m[1].toUpperCase() : null
}

function formatWikidataValue(value: unknown, type: string): string {
  if (type === 'time' && value && typeof value === 'object' && 'time' in value) {
    const t = (value as { time: string }).time
    const m = t.match(/([+-]?\d{4,})-(\d{2})-(\d{2})/)
    if (m) return `${m[1].replace(/^\+/, '')}-${m[2]}-${m[3]}`
    const y = t.match(/([+-]?\d{4,})/)
    return y ? y[1].replace(/^\+/, '') : t
  }
  if (type === 'wikibase-entityid' && value && typeof value === 'object' && 'id' in value) {
    return (value as { id: string }).id
  }
  if (type === 'string' || type === 'monolingualtext') {
    if (typeof value === 'string') return value
    if (value && typeof value === 'object' && 'text' in value) {
      return String((value as { text: string }).text)
    }
  }
  if (type === 'quantity' && value && typeof value === 'object' && 'amount' in value) {
    return String((value as { amount: string }).amount).replace(/^\+/, '')
  }
  if (typeof value === 'string') return value
  return ''
}

async function fetchEntities(ids: string[], lang: string): Promise<Record<string, WbEntity>> {
  if (!ids.length) return {}
  const unique = [...new Set(ids)].slice(0, 50)
  const url = `${WIKIDATA_API}?action=wbgetentities&ids=${unique.join('|')}&props=labels&languages=${lang}|en&format=json`
  try {
    const res = await fetch(url)
    if (!res.ok) return {}
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) return {}
    const text = await res.text()
    if (!text || text.trimStart().startsWith('<')) return {}
    const data = JSON.parse(text) as { entities?: Record<string, WbEntity> }
    return data.entities ?? {}
  } catch {
    return {}
  }
}

function labelFromEntity(entity: WbEntity | undefined, lang: string): string {
  if (!entity?.labels) return ''
  return entity.labels[lang]?.value ?? entity.labels.en?.value ?? Object.values(entity.labels)[0]?.value ?? ''
}

function claimPointInTime(claim: WbClaim): string | undefined {
  const dv =
    claim.qualifiers?.P585?.[0]?.mainsnak?.datavalue ??
    claim.qualifiers?.P580?.[0]?.mainsnak?.datavalue
  if (!dv) return undefined
  return formatWikidataValue(dv.value, dv.type)
}

function yearFromDate(raw?: string): string | undefined {
  return raw?.match(/(\d{4})/)?.[1]
}

function pushMilestone(
  facts: ProfileFact[],
  seen: Set<string>,
  year: string | undefined,
  label: string,
) {
  if (!year || !label) return
  const value = `${year}|${label}`
  if (seen.has(value)) return
  seen.add(value)
  facts.push({
    predicate: 'http://www.wikidata.org/prop/qualifier/P585',
    predicateLabel: 'company milestone',
    value,
    source: 'wikidata',
    group: 'life',
  })
}

function p31IdsFromEntity(entity: WbEntity): string[] {
  return (entity.claims?.P31 ?? [])
    .map((c) => c.mainsnak?.datavalue?.value)
    .filter((v): v is { id: string } => !!v && typeof v === 'object' && 'id' in v)
    .map((v) => v.id)
}

function wikipediaTitleFromEntity(entity: WbEntity | undefined, lang: string): string | undefined {
  const site = `${lang}wiki`
  return entity?.sitelinks?.[site]?.title ?? entity?.sitelinks?.enwiki?.title
}

/** Fetch structured facts via Wikidata MediaWiki API (reliable when SPARQL is slow). */
export async function fetchWikidataClaimFacts(
  entityUri: string,
  lang: string,
  preloadedEntity?: WbEntity,
): Promise<WikidataClaimBundle> {
  const qid = qidFromUri(entityUri)
  if (!qid) return { facts: [] }

  let entity = preloadedEntity
  if (!entity) {
    const url = `${WIKIDATA_API}?action=wbgetentities&ids=${qid}&props=claims|labels|descriptions|sitelinks&languages=${lang}|en&format=json`
    try {
      const res = await fetch(url)
      if (!res.ok) return { facts: [] }
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('json')) return { facts: [] }
      const text = await res.text()
      if (!text || text.trimStart().startsWith('<')) return { facts: [] }
      const data = JSON.parse(text) as { entities?: Record<string, WbEntity> }
      entity = data.entities?.[qid]
    } catch {
      return { facts: [] }
    }
  }

  const imageUrl = await imageUrlFromEntityClaims(entity, 480)
  if (!entity?.claims) {
    const wikiTitle = wikipediaTitleFromEntity(entity, lang)
    return {
      facts: [],
      label: labelFromEntity(entity, lang),
      description: entity?.descriptions?.[lang]?.value ?? entity?.descriptions?.en?.value,
      kind: entity ? classifyKindFromP31(p31IdsFromEntity(entity)) : undefined,
      wikipediaTitle: wikiTitle,
      wikipediaLang: wikiTitle ? lang : undefined,
      imageUrl,
    }
  }

  const label = labelFromEntity(entity, lang)
  const description = entity.descriptions?.[lang]?.value ?? entity.descriptions?.en?.value
  const kind = classifyKindFromP31(p31IdsFromEntity(entity))

  const entityIds = new Set<string>()
  const rawFacts: {
    propId: string
    label: string
    group: ProfileFactGroup
    raw: string
    valueUri?: string
  }[] = []

  for (const def of CLAIM_PROPS) {
    const claims = entity.claims[def.id]
    if (!claims?.length) continue
    for (const claim of claims.slice(0, 12)) {
      const dv = claim.mainsnak?.datavalue
      if (!dv) continue
      const raw = formatWikidataValue(dv.value, dv.type)
      if (!raw) continue
      let valueUri: string | undefined
      if (dv.type === 'wikibase-entityid') {
        entityIds.add(raw)
        valueUri = `http://www.wikidata.org/entity/${raw}`
      }
      rawFacts.push({ propId: def.id, label: def.label, group: def.group, raw, valueUri })
    }
  }

  const entityMap = await fetchEntities([...entityIds], lang)

  const extraIds = new Set<string>()
  for (const claim of [...(entity.claims.P793 ?? []), ...(entity.claims.P169 ?? [])]) {
    const dv = claim.mainsnak?.datavalue
    if (dv?.type !== 'wikibase-entityid') continue
    const id = formatWikidataValue(dv.value, dv.type)
    if (id && !entityMap[id]) extraIds.add(id)
  }
  if (extraIds.size) {
    Object.assign(entityMap, await fetchEntities([...extraIds], lang))
  }

  const facts: ProfileFact[] = []
  const seen = new Set<string>()
  for (const rf of rawFacts) {
    let value = rf.raw
    if (entityMap[rf.raw]) {
      value = labelFromEntity(entityMap[rf.raw], lang) || rf.raw
    }
    if (/^Q\d+$/i.test(value)) continue
    const key = `${rf.label}|${value}`
    if (seen.has(key)) continue
    seen.add(key)
    facts.push({
      predicate: `http://www.wikidata.org/prop/direct/${rf.propId}`,
      predicateLabel: rf.label,
      value,
      valueUri: rf.valueUri,
      source: 'wikidata',
      group: rf.group,
    })
  }

  const milestoneClaims = entity.claims.P793 ?? []
  for (const claim of milestoneClaims.slice(0, 24)) {
    const dv = claim.mainsnak?.datavalue
    if (!dv || dv.type !== 'wikibase-entityid') continue
    const qid = formatWikidataValue(dv.value, dv.type)
    const eventLabel = labelFromEntity(entityMap[qid], lang)
    if (!eventLabel || /^Q\d+$/i.test(eventLabel)) continue
    const year = yearFromDate(claimPointInTime(claim))
    pushMilestone(facts, seen, year, eventLabel)
  }

  for (const claim of entity.claims.P571 ?? []) {
    const dv = claim.mainsnak?.datavalue
    if (!dv) continue
    const date = formatWikidataValue(dv.value, dv.type)
    const year = yearFromDate(date) ?? yearFromDate(claimPointInTime(claim))
    pushMilestone(facts, seen, year, 'Company founded')
  }

  for (const claim of entity.claims.P169 ?? []) {
    const dv = claim.mainsnak?.datavalue
    if (!dv || dv.type !== 'wikibase-entityid') continue
    const qid = formatWikidataValue(dv.value, dv.type)
    const ceo = labelFromEntity(entityMap[qid], lang)
    if (!ceo || /^Q\d+$/i.test(ceo)) continue
    const year = yearFromDate(claimPointInTime(claim))
    pushMilestone(facts, seen, year, `${ceo} becomes CEO`)
  }

  const wikiTitle = wikipediaTitleFromEntity(entity, lang)
  return {
    facts,
    description,
    label,
    kind,
    wikipediaTitle: wikiTitle,
    wikipediaLang: wikiTitle ? lang : undefined,
    imageUrl,
  }
}

export function claimFactsToInfobox(facts: ProfileFact[]): InfoboxRow[] {
  const byLabel = new Map<string, string[]>()
  for (const f of facts) {
    const list = byLabel.get(f.predicateLabel) ?? []
    if (!list.includes(f.value)) list.push(f.value)
    byLabel.set(f.predicateLabel, list)
  }

  const row = (label: string, keys: string[]): InfoboxRow | null => {
    const values: string[] = []
    for (const k of keys) {
      for (const v of byLabel.get(k) ?? []) {
        if (!values.includes(v)) values.push(v)
      }
    }
    if (!values.length) return null
    return { label, values: values.map((text) => ({ text })) }
  }

  const born = (() => {
    const date = byLabel.get('date of birth')?.[0]
    const place = byLabel.get('place of birth')?.[0]
    if (!date && !place) return null
    return {
      label: 'Born',
      values: [{ text: [date, place ? `in ${place}` : ''].filter(Boolean).join(' ') }],
    }
  })()

  return [
    born,
    row('Citizenship', ['country of citizenship']),
    row('Occupation', ['occupation']),
    row('Education', ['educated at']),
    row('Spouse', ['spouse', 'unmarried partner']),
    row('Children', ['child']),
    row('Parent(s)', ['father', 'mother']),
    row('Awards', ['award received']),
    row('Website', ['official website']),
    row('Industry', ['industry']),
    row('Headquarters', ['headquarters']),
    row('Founded', ['inception']),
    row('Genre', ['genre']),
    row('Country', ['country of origin']),
    row('Language', ['original language']),
    row('Directed by', ['director']),
    row('Written by', ['screenwriter']),
    row('Produced by', ['producer']),
    row('Starring', ['cast member']),
    row('Release date', ['publication date', 'release date']),
    row('Studio', ['production company']),
    row('Music by', ['composer']),
    row('Duration', ['duration']),
    row('CEO', ['chief executive officer']),
    row('Employees', ['employees']),
  ].filter((r): r is InfoboxRow => r !== null)
}

export { qidFromUri }
