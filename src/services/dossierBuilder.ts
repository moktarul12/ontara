import type { EntityArticle, ArticleSection } from '../types/entityArticle'
import type {
  AwardCard,
  CareerEra,
  CareerSubtrack,
  DossierTabId,
  EntityDossier,
  FactGroup,
  HeroFactPill,
  HeroMetric,
  LinkedPerson,
  Milestone,
  QuickFact,
  QuickFactsCardItem,
  SourceRef,
  StoryBeat,
  VerifiedFact,
  WorkCard,
} from '../types/entityDossier'
import type { EntityProfile, ProfileFact } from './entityProfile'
import { verifyProfileFacts } from './factVerifier'
import { buildGroupNarrative } from '../utils/profileNarrative'
import {
  buildReadingHook,
  buildStoryParagraph,
  verifiedTrivia,
} from '../utils/readingNarrative'
import { synthesizeCareerBrief, synthesizeNarrative } from './contentSynthesizer'
import { cleanValues, formatFactDisplay, formatFactValue, formatDisplayDate, formatRevenue, formatEmployees, pickTopNumeric } from '../utils/factFormatter'

function factsFor(profile: EntityProfile, ...labels: string[]): string[] {
  const want = new Set(labels.map((l) => l.toLowerCase()))
  const out: string[] = []
  const seen = new Set<string>()
  for (const f of profile.facts) {
    if (!want.has(f.predicateLabel.toLowerCase())) continue
    const key = f.value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(f.value)
  }
  return cleanValues(out)
}

function factGroups(profile: EntityProfile, labels: string[]): FactGroup[] {
  return labels
    .map((label) => {
      const values = factsFor(profile, label)
      if (!values.length) return null
      const formatted = formatFactDisplay(label, values)
      return {
        label: formatted.label,
        values: formatted.values ?? [formatted.display],
      }
    })
    .filter((g): g is FactGroup => g !== null)
}

function releaseYear(profile: EntityProfile): string | undefined {
  const raw = factsFor(profile, 'publication date', 'release date')[0]
  if (!raw) return undefined
  const m = raw.match(/([+-]?\d{4})/)
  return m ? m[1].replace(/^\+/, '') : undefined
}

function yearsActive(profile: EntityProfile): string | undefined {
  const dob = factsFor(profile, 'date of birth')[0]
  if (!dob) return undefined
  const year = parseInt(dob.slice(0, 4), 10)
  if (Number.isNaN(year)) return undefined
  const span = new Date().getFullYear() - year
  if (span < 5) return undefined
  if (span >= 50) return '50+ Years'
  return `${span}+ Years`
}

function formatMetricCount(n: number): string {
  if (n >= 200) return '200+'
  if (n >= 100) return '100+'
  if (n >= 50) return '50+'
  if (n >= 25) return '25+'
  return String(n)
}

function firstSentences(text: string, count = 2): string {
  const parts = text.match(/[^.!?]+[.!?]+/g)
  if (!parts?.length) return text.trim()
  return parts.slice(0, count).join(' ').trim()
}

function aboutTeaser(text: string): string {
  let teaser = firstSentences(text, 2)
  if (teaser.length > 340) {
    const cut = teaser.slice(0, 337)
    const sp = cut.lastIndexOf(' ')
    teaser = `${cut.slice(0, sp > 200 ? sp : 337)}…`
  }
  return teaser
}

const SKIP_ERA_TITLES =
  /filmography|discography|bibliography|awards?|honou?rs?|personal life|family|references|see also|external links|further reading|notes|footnotes|list of|selected|complete/i

function isCareerPhaseSection(title: string, level: number): boolean {
  if (level > 3) return false
  if (SKIP_ERA_TITLES.test(title)) return false
  if (/^(early|beginning|rise|breakthrough|later|comeback|political|television|international|recent|mainstream|stardom|decline|revival)/i.test(title)) {
    return true
  }
  if (/\b(19|20)\d{2}s?\b/.test(title) && /career|acting|film|work|life/i.test(title)) return true
  if (/\(\d{4}[–-]\d{2,4}\)/.test(title)) return true
  if (/^career$/i.test(title.trim())) return true
  if (/acting career|film career|music career|political career/i.test(title)) return true
  return false
}

function flattenSections(sections: ArticleSection[]): ArticleSection[] {
  const out: ArticleSection[] = []
  const walk = (list: ArticleSection[]) => {
    for (const s of list) {
      out.push(s)
      walk(s.children)
    }
  }
  walk(sections)
  return out
}

function sectionText(sections: ArticleSection[], pattern: RegExp, maxLen = 600): string | undefined {
  const flat = flattenSections(sections)
  const hit = flat.find((s) => pattern.test(s.title))
  if (!hit?.paragraphs?.length) return undefined
  const text = hit.paragraphs.join(' ')
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const sp = cut.lastIndexOf(' ')
  return `${cut.slice(0, sp > 300 ? sp : maxLen)}…`
}

function infoboxValues(article: EntityArticle, label: string): string[] {
  const row = article.infobox.find((r) => r.label.toLowerCase() === label.toLowerCase())
  return row?.values.map((v) => v.text) ?? []
}

function buildSubtitle(profile: EntityProfile): string | undefined {
  if (profile.kind === 'work') {
    const parts = [
      factsFor(profile, 'genre').slice(0, 2).join(', '),
      releaseYear(profile),
      factsFor(profile, 'country of origin')[0],
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : factsFor(profile, 'instance of')[0]
  }
  if (profile.kind === 'org') {
    const parts = [
      factsFor(profile, 'industry')[0],
      factsFor(profile, 'country', 'country of origin')[0],
    ].filter(Boolean)
    return parts.length ? parts.join(' · ') : factsFor(profile, 'instance of')[0]
  }
  const occ = factsFor(profile, 'occupation').slice(0, 3)
  if (!occ.length) return undefined
  return occ.join(' · ')
}

function buildHeroFactPills(profile: EntityProfile): HeroFactPill[] {
  const pills: HeroFactPill[] = []

  if (profile.kind === 'work') {
    const released = factsFor(profile, 'publication date', 'release date')[0]
    const genre = factsFor(profile, 'genre')[0]
    const country = factsFor(profile, 'country of origin')[0]
    if (released) pills.push({ label: 'Released', value: formatFactValue('release date', released) })
    if (genre) pills.push({ label: 'Genre', value: genre })
    if (country) pills.push({ label: 'Country', value: country })
    return pills
  }

  if (profile.kind === 'org') {
    const founded = factsFor(profile, 'inception', 'founded')[0]
    const hq = factsFor(profile, 'headquarters', 'headquarters location')[0]
    const industry = factsFor(profile, 'industry')[0]
    if (founded) pills.push({ label: 'Founded', value: formatFactValue('founded', founded) })
    if (hq) pills.push({ label: 'Headquarters', value: hq })
    if (industry) pills.push({ label: 'Industry', value: industry })
    return pills
  }

  const dob = factsFor(profile, 'date of birth')[0]
  const birth = factsFor(profile, 'place of birth')[0]
  const active = yearsActive(profile)

  if (dob) pills.push({ label: 'Born', value: formatDisplayDate(dob) })
  if (birth) pills.push({ label: 'Birthplace', value: birth })
  if (active) pills.push({ label: 'Years Active', value: active })

  return pills
}

function buildHeroMetrics(
  worksCount: number,
  awards: { won: AwardCard[]; nominated: AwardCard[] },
  profile: EntityProfile,
): HeroMetric[] {
  const metrics: HeroMetric[] = []

  if (profile.kind === 'work') {
    const castCount = factsFor(profile, 'cast member', 'voice actor').length
    const year = releaseYear(profile)
    if (year) metrics.push({ label: 'Released', value: year, icon: 'years' })
    if (castCount > 0) metrics.push({ label: 'Cast', value: String(castCount), icon: 'film' })
    if (awards.won.length > 0) {
      metrics.push({ label: 'Awards', value: String(awards.won.length), icon: 'award' })
    }
    const genres = factsFor(profile, 'genre').length
    if (genres > 0) metrics.push({ label: 'Genres', value: String(genres), icon: 'star' })
    return metrics.slice(0, 4)
  }

  if (profile.kind === 'org') {
    const founded =
      releaseYear(profile) ?? factsFor(profile, 'inception', 'founded')[0]?.match(/\d{4}/)?.[0]
    if (founded) metrics.push({ label: 'Founded', value: founded, icon: 'years' })
    const rev = pickTopNumeric(factsFor(profile, 'revenue'), 1)[0]
    if (rev) metrics.push({ label: 'Revenue', value: formatRevenue(rev), icon: 'award' })
    const net = pickTopNumeric(factsFor(profile, 'net profit'), 1)[0]
    if (net) metrics.push({ label: 'Net Income', value: formatRevenue(net), icon: 'star' })
    const cap = pickTopNumeric(factsFor(profile, 'market capitalization'), 1)[0]
    if (cap) metrics.push({ label: 'Market Cap', value: formatRevenue(cap), icon: 'film' })
    const ticker = factsFor(profile, 'ticker symbol')[0]
    if (ticker) metrics.push({ label: 'Ticker', value: ticker, icon: 'years' })
    const emp = pickTopNumeric(factsFor(profile, 'employees'), 1)[0]
    if (emp && metrics.length < 5) metrics.push({ label: 'Employees', value: formatEmployees(emp), icon: 'film' })
    return metrics.slice(0, 5)
  }

  const active = yearsActive(profile)

  if (worksCount > 0) {
    metrics.push({
      label: worksCount === 1 ? 'Work' : 'Films',
      value: formatMetricCount(worksCount),
      icon: 'film',
    })
  }
  if (awards.won.length > 0) {
    metrics.push({
      label: 'Awards',
      value: String(awards.won.length),
      icon: 'award',
    })
  }
  const honours = awards.won.length + awards.nominated.length
  if (honours > awards.won.length) {
    metrics.push({
      label: 'Honours',
      value: formatMetricCount(honours),
      icon: 'star',
    })
  }
  if (active) {
    metrics.push({ label: 'In Industry', value: active.replace(' Years', ''), icon: 'years' })
  }

  return metrics.slice(0, 4)
}

function buildQuickFactsCard(profile: EntityProfile, article: EntityArticle): QuickFactsCardItem[] {
  const items: QuickFactsCardItem[] = []
  const push = (label: string, values: string[]) => {
    if (!values.length) return
    const formatted = formatFactDisplay(label, values)
    items.push({ label: formatted.label, value: formatted.display })
  }

  if (profile.kind === 'work') {
    push('Director', factsFor(profile, 'director'))
    push('Genre', factsFor(profile, 'genre'))
    push('Released', factsFor(profile, 'publication date', 'release date'))
    push('Language', factsFor(profile, 'original language'))
    push('Country', factsFor(profile, 'country of origin'))
    push('Studio', factsFor(profile, 'production company'))
  } else if (profile.kind === 'org') {
    push('Industry', factsFor(profile, 'industry'))
    push('Founded', factsFor(profile, 'inception', 'founded'))
    push('Headquarters', factsFor(profile, 'headquarters', 'headquarters location'))
    push('CEO', factsFor(profile, 'chief executive officer'))
    push('Employees', factsFor(profile, 'employees'))
    push('Revenue', factsFor(profile, 'revenue'))
    push('Country', factsFor(profile, 'country', 'country of origin'))
  } else {
    push('Nationality', factsFor(profile, 'country of citizenship'))
    push('Languages', factsFor(profile, 'languages spoken', 'native language'))
    push('Occupation', factsFor(profile, 'occupation'))
    push('Known For', factsFor(profile, 'notable work').slice(0, 2))
    push('Spouse', factsFor(profile, 'spouse', 'unmarried partner'))
  }

  if (!items.length) {
    for (const row of article.infobox.slice(0, 5)) {
      items.push({
        label: row.label,
        value: row.values.map((v) => formatFactValue(row.label, v.text)).join(', '),
      })
    }
  }

  return items.slice(0, 6)
}

function buildPersonalDetails(profile: EntityProfile, article: EntityArticle): QuickFact[] {
  const details: QuickFact[] = []
  const add = (label: string, ...keys: string[]) => {
    const values = factsFor(profile, ...keys)
    if (!values.length) return
    const formatted = formatFactDisplay(label, values)
    details.push({
      label: formatted.label,
      value: formatted.display,
      values: formatted.values,
    })
  }

  if (profile.kind === 'work') {
    add('Director', 'director')
    add('Written by', 'screenwriter')
    add('Produced by', 'producer', 'executive producer')
    add('Music by', 'composer')
    add('Release', 'publication date', 'release date')
    add('Genre', 'genre')
    add('Country', 'country of origin')
    add('Language', 'original language')
    add('Studio', 'production company')
    add('Distributed by', 'distributed by')
    return details
  }

  if (profile.kind === 'org') {
    add('Type', 'instance of')
    add('Industry', 'industry')
    add('Founded', 'inception', 'founded')
    add('Headquarters', 'headquarters', 'headquarters location')
    add('CEO', 'chief executive officer')
    add('Employees', 'employees')
    add('Country', 'country', 'country of origin')
    add('Website', 'official website')
    return details
  }

  add('Full Name', 'birth name')
  if (!details.some((d) => d.label === 'Full Name')) {
    const born = infoboxValues(article, 'Born')
    if (born[0]) details.push({ label: 'Full Name', value: article.label })
  }
  add('Born', 'date of birth')
  add('Birthplace', 'place of birth')
  add('Nationality', 'country of citizenship')
  add('Religion', 'religion')
  add('Languages', 'languages spoken', 'native language')

  return details
}

function buildCareerEras(sections: ArticleSection[], profile: EntityProfile): CareerEra[] {
  const flat = flattenSections(sections)
  const eras: CareerEra[] = []
  const seen = new Set<string>()

  for (const s of flat) {
    if (!isCareerPhaseSection(s.title, s.level)) continue
    const eraMatch = s.title.match(/\(([^)]+)\)/)
    const yearMatch = s.title.match(/\b((?:19|20)\d{2}(?:s)?(?:\s*[–-]\s*(?:19|20)\d{2,4})?)\b/)
    const era = eraMatch?.[1] ?? yearMatch?.[1] ?? ''
    const title = s.title.replace(/\s*\([^)]*\)\s*/, '').trim()
    const key = `${era}|${title}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    eras.push({ era: era || title, title })
  }

  if (eras.length >= 2) return eras.slice(0, 5)

  const dob = factsFor(profile, 'date of birth')[0]?.slice(0, 4)
  const occ = factsFor(profile, 'occupation').slice(0, 2)
  const fallback: CareerEra[] = []
  if (dob) fallback.push({ era: dob, title: 'Career begins' })
  for (const o of occ) fallback.push({ era: '', title: o })
  return fallback.slice(0, 4)
}

function buildStoryBeats(
  profile: EntityProfile,
  works: WorkCard[],
  awards: { won: AwardCard[] },
  verified: VerifiedFact[] = [],
): StoryBeat[] {
  const isConfirmed = (detail: string) =>
    verified.some(
      (f) =>
        f.status === 'confirmed' &&
        (f.value === detail || f.values?.includes(detail) || detail.includes(f.value)),
    )

  const beats: StoryBeat[] = []
  const push = (icon: string, label: string, detail: string) => {
    if (!detail || beats.some((b) => b.detail === detail)) return
    beats.push({ icon, label, detail, verified: isConfirmed(detail) })
  }

  if (profile.kind === 'work') {
    push('🎬', 'Directed by', factsFor(profile, 'director').slice(0, 2).join(', '))
    push('⭐', 'Starring', factsFor(profile, 'cast member').slice(0, 3).join(', '))
    push('🎭', 'Genre', factsFor(profile, 'genre').slice(0, 2).join(', '))
    push('🏆', 'Awarded', awards.won[0]?.name ?? factsFor(profile, 'award received')[0] ?? '')
    return beats.slice(0, 4)
  }

  if (profile.kind === 'org') {
    push('🏢', 'Industry', factsFor(profile, 'industry')[0] ?? '')
    push('📍', 'Headquarters', factsFor(profile, 'headquarters', 'headquarters location')[0] ?? '')
    push('👤', 'Led by', factsFor(profile, 'chief executive officer')[0] ?? '')
    push('🌍', 'Country', factsFor(profile, 'country', 'country of origin')[0] ?? '')
    return beats.filter((b) => b.detail).slice(0, 4)
  }

  push('🎬', 'Profession', factsFor(profile, 'occupation').slice(0, 2).join(', '))
  push('🏆', 'Honoured with', awards.won[0]?.name ?? factsFor(profile, 'award received')[0] ?? '')
  push('⭐', 'Known for', works[0]?.title ?? factsFor(profile, 'notable work')[0] ?? '')
  push('🌍', 'From', factsFor(profile, 'country of citizenship')[0] ?? '')
  push('🗣', 'Speaks', factsFor(profile, 'languages spoken').slice(0, 2).join(', '))

  return beats.filter((b) => b.detail).slice(0, 4)
}

function castFromProfile(profile: EntityProfile): WorkCard[] {
  const seen = new Set<string>()
  const out: WorkCard[] = []
  for (const f of profile.facts) {
    const key = f.predicateLabel.toLowerCase()
    if (key !== 'cast member' && key !== 'voice actor') continue
    if (seen.has(f.value)) continue
    seen.add(f.value)
    out.push({ title: f.value, role: 'Cast', uri: f.valueUri })
  }
  return out
}

function buildLifeTimeline(profile: EntityProfile): Milestone[] {
  const items: Milestone[] = []

  if (profile.kind === 'work') {
    const released = factsFor(profile, 'publication date', 'release date')[0]
    if (released) {
      items.push({
        year: released.match(/\d{4}/)?.[0],
        label: 'Released',
        detail: formatDisplayDate(released),
      })
    }
    return items
  }

  if (profile.kind === 'org') {
    const founded = factsFor(profile, 'inception', 'founded')[0]
    if (founded) {
      items.push({
        year: founded.match(/\d{4}/)?.[0],
        label: 'Company founded',
        detail: formatDisplayDate(founded),
      })
    }
    for (const m of profile.facts) {
      if (m.predicateLabel !== 'company milestone') continue
      const match = m.value.match(/^(\d{4})\|(.+)$/)
      if (match) items.push({ year: match[1], label: match[2] })
    }
    return items
      .sort((a, b) => parseInt(a.year ?? '9999', 10) - parseInt(b.year ?? '9999', 10))
      .slice(0, 16)
  }

  const dob = factsFor(profile, 'date of birth')[0]
  const birth = factsFor(profile, 'place of birth')[0]
  if (dob || birth) {
    items.push({
      year: dob?.slice(0, 4),
      label: 'Born',
      detail: [dob ? formatDisplayDate(dob) : '', birth ? `in ${birth}` : '']
        .filter(Boolean)
        .join(' '),
    })
  }
  for (const school of factsFor(profile, 'educated at').slice(0, 3)) {
    items.push({ label: 'Education', detail: school })
  }
  const dod = factsFor(profile, 'date of death')[0]
  if (dod) {
    items.push({ year: dod.slice(0, 4), label: 'Died', detail: formatDisplayDate(dod) })
  }
  return items
}

function buildFamilyMembers(profile: EntityProfile): LinkedPerson[] {
  const rels: { relation: string; labels: string[] }[] = [
    { relation: 'Father', labels: ['father'] },
    { relation: 'Mother', labels: ['mother'] },
    { relation: 'Spouse', labels: ['spouse', 'unmarried partner'] },
    { relation: 'Child', labels: ['child'] },
    { relation: 'Sibling', labels: ['sibling'] },
  ]
  const out: LinkedPerson[] = []
  const seen = new Set<string>()
  for (const r of rels) {
    for (const f of profile.facts) {
      if (!r.labels.includes(f.predicateLabel.toLowerCase())) continue
      const key = `${r.relation}|${f.value}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ name: f.value, relation: r.relation, uri: f.valueUri })
    }
  }
  return out.slice(0, 24)
}

function worksFromArticle(article: EntityArticle, profile: EntityProfile): WorkCard[] {
  if (profile.kind === 'work') {
    const cast = castFromProfile(profile)
    if (cast.length) return cast
  }

  for (const s of flattenSections(article.sections)) {
    for (const t of s.tables ?? []) {
      if (/filmography|works|discography/i.test(t.title) || t.id === 'filmography') {
        return t.rows.map((row) => ({
          year: row.year !== '—' ? row.year : undefined,
          title: row.title ?? '',
          role: row.role && row.role !== '—' ? row.role : undefined,
        }))
      }
    }
  }
  const notable: WorkCard[] = []
  const seen = new Set<string>()
  for (const f of profile.facts) {
    const key = f.predicateLabel.toLowerCase()
    if (key !== 'notable work' && key !== 'cast member') continue
    if (seen.has(f.value)) continue
    seen.add(f.value)
    notable.push({ title: f.value, uri: f.valueUri })
  }
  return notable.slice(0, 40)
}

function awardsFromArticle(article: EntityArticle, profile: EntityProfile): {
  won: AwardCard[]
  nominated: AwardCard[]
} {
  const won: AwardCard[] = []
  const nominated: AwardCard[] = []

  for (const s of flattenSections(article.sections)) {
    for (const t of s.tables ?? []) {
      if (!/award/i.test(t.title)) continue
      for (const row of t.rows) {
        const card: AwardCard = {
          year: row.year !== '—' ? row.year : undefined,
          name: row.award ?? row.title ?? '',
          result: /nominated/i.test(row.result ?? '') ? 'nominated' : 'won',
        }
        if (card.result === 'nominated') nominated.push(card)
        else won.push(card)
      }
    }
  }

  if (!won.length) {
    for (const name of factsFor(profile, 'award received').slice(0, 20)) {
      won.push({ name, result: 'won' })
    }
  }
  if (!nominated.length) {
    for (const name of factsFor(profile, 'nominated for').slice(0, 12)) {
      nominated.push({ name, result: 'nominated' })
    }
  }

  return { won, nominated }
}

function buildCareerSubtracks(profile: EntityProfile, label: string): CareerSubtrack[] {
  const defs = [
    { id: 'acting', title: 'Acting', match: /actor|actress|cast|film|television|voice/i },
    { id: 'production', title: 'Production', match: /direct|produc|screenplay|writer/i },
    { id: 'business', title: 'Business', match: /employer|owner|founded|board|business/i },
  ]
  const careerFacts = profile.factsByGroup.career
  const out: CareerSubtrack[] = []
  const used = new Set<string>()

  for (const def of defs) {
    const matched = careerFacts.filter((f: ProfileFact) => {
      const key = `${f.predicateLabel}|${f.value}`
      if (used.has(key)) return false
      if (!def.match.test(`${f.predicateLabel} ${f.value}`)) return false
      used.add(key)
      return true
    })
    if (!matched.length) continue
    const highlights = matched.map((f) => f.value).slice(0, 6)
    const summary = buildGroupNarrative('career', matched, label)
    out.push({ id: def.id, title: def.title, summary: summary || undefined, highlights })
  }
  return out
}

function buildQuote(article: EntityArticle, profile: EntityProfile, aboutTeaserText?: string): string | undefined {
  const desc = profile.description?.trim()
  if (desc && desc.length > 30 && desc.length < 200) {
    if (aboutTeaserText && desc === aboutTeaserText) return undefined
    return desc
  }
  const lead = article.lead.text?.trim()
  if (!lead) return undefined
  const sentence = lead.match(/[^.!?]+[.!?]+/)?.[0]?.trim()
  if (!sentence || sentence.length < 40) return undefined
  if (aboutTeaserText && aboutTeaserText.includes(sentence.slice(0, 40))) return undefined
  return sentence
}

function buildWebsite(profile: EntityProfile): string | undefined {
  return factsFor(profile, 'official website')[0]
}

function buildImdbUrl(profile: EntityProfile): string | undefined {
  const id = factsFor(profile, 'IMDb ID')[0]
  if (!id) return undefined
  if (id.startsWith('http')) return id
  if (/^nm\d+$/i.test(id)) return `https://www.imdb.com/name/${id}/`
  if (/^tt\d+$/i.test(id)) return `https://www.imdb.com/title/${id}/`
  return undefined
}

function availableTabs(dossier: Omit<EntityDossier, 'availableTabs'>): DossierTabId[] {
  const tabs: DossierTabId[] = ['summary']
  if (dossier.life.timeline.length || dossier.life.facts.length || dossier.life.narrative) {
    tabs.push('life')
  }
  if (
    dossier.career.subtracks.length ||
    dossier.career.facts.length ||
    dossier.career.narrative ||
    dossier.career.summary
  ) {
    tabs.push('career')
  }
  if (dossier.family.members.length || dossier.family.narrative) tabs.push('family')
  if (dossier.works.items.length) tabs.push('works')
  if (dossier.awards.won.length || dossier.awards.nominated.length) tabs.push('awards')
  tabs.push('sources')
  return tabs
}

export function buildEntityDossier(
  article: EntityArticle,
  profile: EntityProfile,
  enriched = true,
): EntityDossier {
  const works = worksFromArticle(article, profile)
  const awards = awardsFromArticle(article, profile)
  const familyMembers = buildFamilyMembers(profile)

  const lifeNarrative =
    sectionText(article.sections, /early life|background|childhood/i) ??
    buildGroupNarrative('life', profile.factsByGroup.life, article.label)

  const leadText = article.lead.text?.trim()
  const about = leadText ? aboutTeaser(leadText) : profile.longSummary ? aboutTeaser(profile.longSummary) : profile.description
  const wikiText = article.lead.source === 'wikipedia' ? article.lead.text : undefined
  const dbpText = profile.abstractSource === 'dbpedia' ? profile.longSummary : undefined
  const { facts: verifiedFacts, trust } = verifyProfileFacts(profile, wikiText, dbpText)

  const careerNarrative =
    (profile.kind === 'org'
      ? synthesizeNarrative(article.label, 'org', verifiedFacts)
      : undefined) ??
    sectionText(article.sections, /acting career|career/i) ??
    buildGroupNarrative('career', profile.factsByGroup.career, article.label)

  const familyNarrative =
    sectionText(article.sections, /personal life|family/i) ??
    (profile.factsByGroup.family.length
      ? buildGroupNarrative('family', profile.factsByGroup.family, article.label)
      : undefined)

  const sources: SourceRef[] = [
    ...article.references.map((r) => ({
      label: r.label,
      url: r.url,
      source: r.source,
    })),
    ...(article.externalLinks ?? []).map((l) => ({
      label: l.label,
      url: l.url,
      source: 'wikipedia' as const,
    })),
  ]

  const readingHook = buildReadingHook(article.label, article.kind, verifiedFacts)
  const aiNarrative = synthesizeNarrative(article.label, article.kind, verifiedFacts)
  const storyParagraph =
    leadText ||
    aiNarrative ||
    buildStoryParagraph(article.label, article.kind, verifiedFacts, about)

  const partial: Omit<EntityDossier, 'availableTabs'> = {
    uri: article.uri,
    qid: article.qid,
    label: article.label,
    kind: article.kind,
    language: article.language,
    hero: {
      imageUrl: article.lead.imageUrl,
      subtitle: buildSubtitle(profile),
      intro: leadText || storyParagraph || readingHook || about || profile.description,
      metrics: buildHeroMetrics(works.length, awards, profile),
      factPills: buildHeroFactPills(profile),
      quickFactsCard: buildQuickFactsCard(profile, article),
    },
    summary: {
      readingHook: readingHook || undefined,
      storyParagraph: storyParagraph || undefined,
      about: about || undefined,
      aboutSource: article.lead.source ?? profile.abstractSource,
      sourceTrust: trust,
      verifiedFacts,
      storyBeats: buildStoryBeats(profile, works, awards, verifiedFacts),
      personalDetails: buildPersonalDetails(profile, article),
      careerEras: profile.kind === 'person' ? buildCareerEras(article.sections, profile) : [],
      quote: verifiedTrivia(verifiedFacts, profile.description) ?? buildQuote(article, profile, about),
      topWorks: profile.kind === 'work' ? works.slice(0, 8) : works.slice(0, 5),
      topAwards: awards.won.slice(0, 5),
      familyPreview: familyMembers.slice(0, 6),
      website: buildWebsite(profile),
      imdbUrl: buildImdbUrl(profile),
    },
    life: {
      timeline: buildLifeTimeline(profile),
      facts: factGroups(profile, [
        'place of birth',
        'place of death',
        'date of birth',
        'date of death',
        'languages spoken',
        'native language',
      ]),
      narrative: lifeNarrative || undefined,
      narrativeSource: lifeNarrative ? 'wikipedia' : 'wikidata',
    },
    career: {
      summary:
        profile.kind === 'work'
          ? factsFor(profile, 'director', 'genre').slice(0, 4).join(' · ') || undefined
          : profile.kind === 'org'
            ? (synthesizeCareerBrief('org', verifiedFacts) ??
              factsFor(profile, 'industry').slice(0, 2).join(', ')) ||
              undefined
            : factsFor(profile, 'occupation').slice(0, 4).join(', ') || undefined,
      subtracks: buildCareerSubtracks(profile, article.label),
      facts:
        profile.kind === 'work'
          ? factGroups(profile, [
              'director',
              'screenwriter',
              'producer',
              'composer',
              'cast member',
              'genre',
              'production company',
            ])
          : profile.kind === 'org'
            ? factGroups(profile, [
                'industry',
                'chief executive officer',
                'employees',
                'revenue',
                'headquarters',
              ])
            : factGroups(profile, [
                'occupation',
                'employer',
                'educated at',
                'field of work',
                'notable work',
                'member of',
              ]),
      narrative: careerNarrative || undefined,
      narrativeSource: careerNarrative ? 'wikipedia' : 'wikidata',
    },
    family: {
      members: familyMembers,
      narrative: familyNarrative || undefined,
    },
    works: {
      items: works,
      totalCount: works.length,
    },
    awards,
    sources,
    wikipediaUrl: article.wikipediaUrl,
    wikidataUrl: article.wikidataUrl,
    enriched,
    wikipedia: {
      sections: article.sections,
      infobox: article.infobox,
      leadText: article.lead.text,
      leadParagraphs: article.lead.paragraphs,
      sectionToc: article.wikipediaSectionToc,
      externalLinks: article.externalLinks ?? [],
      categories: article.categories ?? [],
    },
  }

  return { ...partial, availableTabs: availableTabs(partial) }
}
