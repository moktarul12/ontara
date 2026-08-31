import type {
  ArticleSection,
  ArticleTable,
  EntityArticle,
  EntityKind,
} from '../types/entityArticle'
import {
  PROFILE_GROUP_TITLES,
  type EntityProfile,
  type ProfileFact,
  type ProfileFactGroup,
} from './entityProfile'
import { buildInfobox } from './infoboxBuilder'
import { fetchAwardsTable, fetchFilmographyTable } from './articleTables'
import { claimFactsToInfobox } from './wikidataClaims'
import {
  fetchWikipediaArticle,
  fetchWikipediaSitelink,
  qidFromUri,
  type WikipediaArticleRaw,
  type WikipediaSectionRaw,
  type WikipediaSitelink,
} from './wikipediaArticle'
import { wikiTocToArticleSections } from './wikiSectionNav'
import { buildGroupNarrative } from '../utils/profileNarrative'

const WIKIDATA_SECTION_ORDER: ProfileFactGroup[] = [
  'life',
  'career',
  'family',
  'awards',
  'links',
  'other',
]

const CAREER_SUBSECTIONS: { id: string; title: string; match: RegExp }[] = [
  { id: 'acting', title: 'Acting', match: /actor|actress|cast in|film|television|voice/i },
  { id: 'production', title: 'Production', match: /direct|produc|screenplay|writer/i },
  { id: 'music', title: 'Music', match: /music|singer|composer|album/i },
  { id: 'politics', title: 'Politics', match: /political|party|position held|election|office/i },
  { id: 'business', title: 'Business', match: /employer|owner|founded|board|company|business/i },
  { id: 'education', title: 'Education', match: /educat|school|university|college/i },
]

function slugId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function wikiToArticleSection(s: WikipediaSectionRaw & { children?: WikipediaSectionRaw[] }): ArticleSection {
  return {
    id: slugId(s.anchor || s.title),
    title: s.title,
    level: s.level,
    paragraphs: s.paragraphs,
    prose: s.paragraphs.join('\n\n'),
    source: 'wikipedia',
    children: (s.children ?? []).map(wikiToArticleSection),
    tables: [],
  }
}

function nestWikiSections(flat: WikipediaSectionRaw[]): (WikipediaSectionRaw & { children: WikipediaSectionRaw[] })[] {
  const roots: (WikipediaSectionRaw & { children: WikipediaSectionRaw[] })[] = []
  const stack: (WikipediaSectionRaw & { children: WikipediaSectionRaw[] })[] = []

  for (const s of flat) {
    const node = { ...s, children: [] as WikipediaSectionRaw[] }
    while (stack.length && stack[stack.length - 1].level >= s.level) stack.pop()
    if (!stack.length) roots.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  return roots
}

function hasSectionTitle(sections: ArticleSection[], pattern: RegExp): boolean {
  for (const s of sections) {
    if (pattern.test(s.title)) return true
    if (s.children.length && hasSectionTitle(s.children, pattern)) return true
  }
  return false
}

function buildCareerSubsections(facts: ProfileFact[], label: string): ArticleSection[] {
  const used = new Set<string>()
  const subsections: ArticleSection[] = []

  for (const def of CAREER_SUBSECTIONS) {
    const matched = facts.filter((f) => {
      const key = `${f.predicateLabel}|${f.value}`
      if (used.has(key)) return false
      if (!def.match.test(`${f.predicateLabel} ${f.value}`)) return false
      used.add(key)
      return true
    })
    if (!matched.length) continue
    const prose = buildGroupNarrative('career', matched, label)
    subsections.push({
      id: `career-${def.id}`,
      title: def.title,
      level: 3,
      prose,
      paragraphs: prose ? [prose] : [],
      children: [],
      source: 'wikidata',
    })
  }

  const remaining = facts.filter((f) => !used.has(`${f.predicateLabel}|${f.value}`))
  if (remaining.length) {
    const prose = buildGroupNarrative('career', remaining, label)
    if (prose) {
      subsections.push({
        id: 'career-other',
        title: 'Other work',
        level: 3,
        prose,
        paragraphs: [prose],
        children: [],
        source: 'wikidata',
      })
    }
  }

  return subsections
}

function buildWikidataSection(
  group: ProfileFactGroup,
  facts: ProfileFact[],
  label: string,
  tables?: ArticleTable[],
): ArticleSection | null {
  if (!facts.length && !tables?.length) return null

  const prose = buildGroupNarrative(group, facts, label)
  const section: ArticleSection = {
    id: slugId(PROFILE_GROUP_TITLES[group]),
    title: PROFILE_GROUP_TITLES[group],
    level: 2,
    prose: prose || undefined,
    paragraphs: prose ? [prose] : [],
    tables: tables ?? [],
    children: [],
    source: 'wikidata',
  }

  if (group === 'career' && facts.length) {
    section.children = buildCareerSubsections(facts, label)
  }

  return section
}

function buildFallbackSections(
  profile: EntityProfile,
  label: string,
  filmography: ArticleTable | null,
  awardsTable: ArticleTable | null,
): ArticleSection[] {
  const sections: ArticleSection[] = []

  for (const group of WIKIDATA_SECTION_ORDER) {
    const facts = profile.factsByGroup[group]
    if (group === 'awards' && awardsTable) {
      sections.push({
        id: 'awards-honours',
        title: 'Awards and honours',
        level: 2,
        paragraphs: [],
        tables: [awardsTable],
        children: [],
        source: 'wikidata',
      })
      continue
    }
    const sec = buildWikidataSection(group, facts, label)
    if (sec) sections.push(sec)
  }

  if (filmography && !sections.some((s) => /filmography/i.test(s.title))) {
    sections.push({
      id: 'filmography',
      title: 'Selected filmography',
      level: 2,
      paragraphs: [],
      tables: [filmography],
      children: [],
      source: 'wikidata',
    })
  }

  return sections
}

function mergeFilmographyTable(
  sections: ArticleSection[],
  filmography: ArticleTable | null,
): ArticleSection[] {
  if (!filmography || filmography.rows.length === 0) return sections
  if (hasSectionTitle(sections, /filmography|selected filmography/i)) {
    const attach = (list: ArticleSection[]): ArticleSection[] =>
      list.map((s) => {
        if (/filmography|selected filmography/i.test(s.title) && !s.tables?.length) {
          return { ...s, tables: [filmography] }
        }
        return { ...s, children: attach(s.children) }
      })
    return attach(sections)
  }
  // Attach to Acting career section when Wikipedia already has one
  let attached = false
  const attachToActing = (list: ArticleSection[]): ArticleSection[] =>
    list.map((s) => {
      if (/acting/i.test(s.title) && !s.tables?.length) {
        attached = true
        return { ...s, tables: [filmography] }
      }
      return { ...s, children: attachToActing(s.children) }
    })
  const withActing = attachToActing(sections)
  if (attached) return withActing

  return [
    ...sections,
    {
      id: 'filmography',
      title: 'Selected filmography',
      level: 2,
      paragraphs: [],
      tables: [filmography],
      children: [],
      source: 'wikidata',
    },
  ]
}

function mergeAwardsTable(sections: ArticleSection[], awards: ArticleTable | null): ArticleSection[] {
  if (!awards) return sections
  if (hasSectionTitle(sections, /award|honour|honor/i)) return sections
  return [
    ...sections,
    {
      id: 'awards-honours',
      title: 'Awards and honours',
      level: 2,
      paragraphs: [],
      tables: [awards],
      children: [],
      source: 'wikidata',
    },
  ]
}

export type BuildArticleOptions = {
  includeSections?: boolean
  includeTables?: boolean
  /** Reuse sitelink from fast shell — skips Wikidata sitelink lookup. */
  sitelink?: WikipediaSitelink | null
  /** Reuse lead from fast shell when includeSections is false. */
  leadWiki?: Omit<WikipediaArticleRaw, 'sections'> | null
}

/** Build a Wikipedia-style article from Wikipedia + Wikidata + profile facts. */
export async function buildEntityArticle(
  profile: EntityProfile,
  lang: string,
  options: BuildArticleOptions = {},
): Promise<EntityArticle> {
  const { includeSections = true, includeTables = true, sitelink: prefetchedSitelink, leadWiki } = options
  const kind = (profile.kind === 'place' ? 'other' : profile.kind) as EntityKind
  const qid = qidFromUri(profile.uri)
  const wikidataUrl = qid ? `https://www.wikidata.org/wiki/${qid}` : undefined

  const sitelink =
    prefetchedSitelink ?? (await fetchWikipediaSitelink(profile.uri, lang))

  let wiki: WikipediaArticleRaw | null = null
  if (leadWiki && !includeSections) {
    wiki = { ...leadWiki, sections: [] }
  } else if (sitelink) {
    wiki = await fetchWikipediaArticle(sitelink.title, sitelink.lang, { includeSections })
  }

  const [filmography, awardsTable] =
    kind === 'person' && includeTables
      ? await Promise.all([
          fetchFilmographyTable(profile.uri, lang),
          fetchAwardsTable(profile.uri, lang),
        ])
      : [null, null]

  const sourcesUsed = new Set<EntityArticle['sourcesUsed'][number]>(profile.sourcesUsed)
  if (wiki) sourcesUsed.add('wikipedia')

  let leadText = wiki?.leadText?.trim() ?? ''
  const leadParagraphs = wiki?.leadParagraphs?.length
    ? wiki.leadParagraphs
    : leadText
      ? [leadText]
      : []
  let leadSource: EntityArticle['lead']['source'] = 'wikipedia'
  let leadImage = wiki?.leadImage ?? profile.imageUrl

  if (!leadText) {
    leadText = profile.longSummary ?? profile.description ?? ''
    leadSource = profile.longSummary ? 'dbpedia' : profile.description ? 'wikidata' : 'generated'
  }

  if (!leadText && profile.facts.length) {
    leadText = buildGroupNarrative('identity', profile.factsByGroup.identity, profile.label)
    leadSource = 'generated'
  }

  let sections: ArticleSection[] = []

  if (wiki?.sections.length) {
    const nested = nestWikiSections(wiki.sections)
    sections = nested.map(wikiToArticleSection)
    sections = mergeFilmographyTable(sections, filmography)
    sections = mergeAwardsTable(sections, awardsTable)

    // Add Wikidata-only sections not covered by Wikipedia
    if (!hasSectionTitle(sections, /family|personal/i) && profile.factsByGroup.family.length) {
      const fam = buildWikidataSection('family', profile.factsByGroup.family, profile.label)
      if (fam) sections.push(fam)
    }
  } else if (leadWiki?.sectionToc?.length) {
    sections = wikiTocToArticleSections(leadWiki.sectionToc)
  } else {
    sections = buildFallbackSections(profile, profile.label, filmography, awardsTable)
  }

  const infoboxFromProfile = buildInfobox(profile, kind)
  const infobox =
    infoboxFromProfile.length > 0 ? infoboxFromProfile : claimFactsToInfobox(profile.facts)

  const references: EntityArticle['references'] = []
  if (wiki?.url) {
    references.push({
      id: 'ref-wikipedia',
      label: `Wikipedia (${wiki.lang})`,
      url: wiki.url,
      source: 'wikipedia',
    })
  }
  if (wikidataUrl) {
    references.push({
      id: 'ref-wikidata',
      label: 'Wikidata',
      url: wikidataUrl,
      source: 'wikidata',
    })
  }
  for (const [source, uri] of Object.entries(profile.sourceUris)) {
    if (!uri || source === 'wikidata') continue
    references.push({
      id: `ref-${source}`,
      label: source,
      url: uri,
      source: source as EntityArticle['references'][0]['source'],
    })
  }

  return {
    uri: profile.uri,
    qid: qid ?? undefined,
    label: wiki?.title ?? profile.label,
    kind,
    language: wiki?.lang ?? lang,
    wikipediaTitle: wiki?.title ?? sitelink?.title,
    wikipediaUrl: wiki?.url ?? sitelink?.url,
    wikidataUrl,
    lead: {
      text: leadText,
      paragraphs: leadParagraphs.length ? leadParagraphs : undefined,
      imageUrl: leadImage,
      source: leadSource,
    },
    infobox,
    sections,
    references,
    sourcesUsed: [...sourcesUsed],
    wikipediaSectionToc: wiki?.sectionToc ?? leadWiki?.sectionToc,
  }
}

export function flattenArticleSections(sections: ArticleSection[]): ArticleSection[] {
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
