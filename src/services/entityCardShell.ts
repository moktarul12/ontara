import type { EntityArticle, EntityKind } from '../types/entityArticle'
import type { EntityProfile, ProfileFact } from './entityProfile'
import {
  groupProfileFacts,
  mergeProfileFacts,
} from './entityProfile'
import { buildInfobox } from './infoboxBuilder'
import { claimFactsToInfobox } from './wikidataClaims'
import { fetchWikidataClaimFacts, qidFromUri } from './wikidataClaims'
import { fetchWikipediaLeadShell, fetchWikipediaIntroParagraphs, type WikipediaLeadShell } from './wikipediaArticle'
import { wikiTocToArticleSections } from './wikiSectionNav'
import { fetchKindFacetFacts, fetchDbpediaAbstractQuick } from './entityProfile'
import { inferKindFromFacts } from './entityKind'
import { upscaleWikiThumb } from './entityImages'
import { buildEntityArticle } from './articleBuilder'
import { fetchWikipediaSupplement } from './wikipediaArticle'

export type CardShell = {
  profile: EntityProfile
  article: EntityArticle
  wiki: WikipediaLeadShell | null
}

const CACHE = new Map<string, { at: number; shell: CardShell }>()
const CACHE_MS = 5 * 60 * 1000

function normalizeUri(uri: string): string {
  const m = uri.match(/^(Q\d+)$/i)
  if (m) return `http://www.wikidata.org/entity/${m[1].toUpperCase()}`
  return uri.trim()
}

function articleKind(kind: EntityProfile['kind']): EntityKind {
  return kind === 'place' ? 'other' : kind
}

function buildMinimalArticle(
  profile: EntityProfile,
  wiki: CardShell['wiki'],
  lang: string,
): EntityArticle {
  const qid = qidFromUri(profile.uri)
  const kind = articleKind(profile.kind)
  const leadText =
    wiki?.leadText?.trim() ||
    profile.longSummary?.trim() ||
    profile.description?.trim() ||
    ''
  const leadParagraphs =
    wiki?.leadParagraphs?.length ? wiki.leadParagraphs : leadText ? [leadText] : undefined

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
  if (qid) {
    references.push({
      id: 'ref-wikidata',
      label: 'Wikidata',
      url: `https://www.wikidata.org/wiki/${qid}`,
      source: 'wikidata',
    })
  }

  const sourcesUsed = new Set<EntityArticle['sourcesUsed'][number]>(profile.sourcesUsed)
  if (wiki) sourcesUsed.add('wikipedia')

  return {
    uri: profile.uri,
    qid: qid ?? undefined,
    label: profile.label,
    kind,
    language: lang,
    wikipediaTitle: wiki?.title,
    wikipediaUrl: wiki?.url,
    wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : undefined,
    lead: {
      text: leadText,
      paragraphs: leadParagraphs,
      imageUrl: wiki?.leadImage ?? profile.imageUrl,
      source: wiki?.leadText
        ? 'wikipedia'
        : profile.abstractSource === 'dbpedia'
          ? 'dbpedia'
          : profile.description
            ? 'wikidata'
            : 'generated',
    },
    infobox,
    sections: wiki?.sectionToc?.length ? wikiTocToArticleSections(wiki.sectionToc) : [],
    references,
    sourcesUsed: [...sourcesUsed],
  }
}

function shellProfile(
  uri: string,
  facts: ProfileFact[],
  kind: EntityProfile['kind'],
  label: string,
  description: string | undefined,
  imageUrl: string | undefined,
  wiki: CardShell['wiki'],
  abstractSource?: EntityProfile['abstractSource'],
  longSummary?: string,
): EntityProfile {
  const sourcesUsed = [...new Set(facts.map((f) => f.source))]
  return {
    uri,
    label: label || wiki?.title || 'Entity',
    description: description ?? wiki?.description,
    longSummary: longSummary ?? wiki?.leadText?.trim(),
    abstractSource,
    imageUrl: imageUrl ?? wiki?.leadImage,
    kind,
    classes: [],
    facts,
    factsByGroup: groupProfileFacts(facts),
    sourcesUsed,
    sourceUris: { wikidata: uri },
  }
}

/** Minimal Wikidata + Wikipedia metadata for instant overview shell (no SPARQL graph). */
export async function fetchEntitySeedMeta(
  uri: string,
  lang: string,
): Promise<{ label: string; kind: EntityKind; imageUrl?: string }> {
  const wdUri = normalizeUri(uri)
  const claims = await fetchWikidataClaimFacts(wdUri, lang)
  const kind = articleKind(
    claims.kind && claims.kind !== 'other'
      ? claims.kind
      : inferKindFromFacts(claims.facts, claims.description),
  )
  return {
    label: claims.label ?? qidFromUri(wdUri) ?? 'Entity',
    kind,
    imageUrl: claims.imageUrl,
  }
}

async function fetchWikipediaLeadFast(
  title: string,
  lang: string,
): Promise<WikipediaLeadShell | null> {
  const [shell, introParagraphs] = await Promise.all([
    fetchWikipediaLeadShell(title, lang),
    fetchWikipediaIntroParagraphs(title, lang),
  ])
  if (!shell) return null
  const leadParagraphs = introParagraphs.length ? introParagraphs : shell.leadParagraphs
  return {
    ...shell,
    leadParagraphs,
    leadText: shell.leadText || introParagraphs[0] || '',
  }
}

/** Fast overview shell: Wikidata claims + Wikipedia summary in parallel (~0.5–1.5s). */
export async function fetchEntityCardShell(uri: string, lang: string): Promise<CardShell> {
  const wdUri = normalizeUri(uri)
  const cacheKey = `${wdUri}|${lang}|shell`
  const hit = CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.shell

  const qid = qidFromUri(wdUri)
  if (!qid) {
    throw new Error('Overview requires a Wikidata entity (Q-id)')
  }

  const claims = await fetchWikidataClaimFacts(wdUri, lang)

  const wikiTitle = claims.wikipediaTitle
  const wikiLang = claims.wikipediaLang ?? lang
  const wiki = wikiTitle ? await fetchWikipediaLeadFast(wikiTitle, wikiLang) : null
  const heroImage =
    claims.imageUrl ?? upscaleWikiThumb(wiki?.leadImage, 480) ?? undefined

  let entityKind: EntityProfile['kind'] =
    claims.kind && claims.kind !== 'other' ? claims.kind : 'other'

  if (entityKind === 'other') {
    entityKind = inferKindFromFacts(claims.facts, claims.description ?? wiki?.description)
  }

  const profile = shellProfile(
    wdUri,
    claims.facts,
    entityKind,
    claims.label ?? wiki?.title ?? qid,
    claims.description,
    heroImage,
    wiki,
  )

  const article = buildMinimalArticle(profile, wiki, lang)
  const shell: CardShell = { profile, article, wiki }
  CACHE.set(cacheKey, { at: Date.now(), shell })
  return shell
}

export type EnrichShellOptions = {
  includeSections?: boolean
  includeTables?: boolean
  fetchSupplement?: boolean
  skipFacets?: boolean
}

function enrichCacheKey(uri: string, lang: string, opts: EnrichShellOptions): string {
  const mode = opts.skipFacets
    ? 'sources'
    : opts.includeSections && opts.includeTables
      ? 'full'
      : opts.fetchSupplement
        ? 'light+supp'
        : 'light'
  return `${uri}|${lang}|enriched|${mode}`
}

/** Background enrich: facet SPARQL + DBpedia + optional Wikipedia sections. */
export async function enrichEntityCardShell(
  shell: CardShell,
  lang: string,
  opts: EnrichShellOptions = {},
): Promise<CardShell> {
  const includeSections = opts.includeSections ?? true
  const includeTables = opts.includeTables ?? includeSections
  const fetchSupplement = opts.fetchSupplement ?? true
  const skipFacets = opts.skipFacets ?? false

  const { profile, wiki } = shell
  const cacheKey = enrichCacheKey(profile.uri, lang, { includeSections, includeTables, fetchSupplement, skipFacets })
  const hit = CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.shell

  let kind = profile.kind
  if (kind === 'other') {
    kind = inferKindFromFacts(profile.facts, profile.description ?? wiki?.description)
  }

  let enrichedProfile = profile
  if (!skipFacets) {
    const [facetFacts, dbpediaAbstract] = await Promise.all([
      fetchKindFacetFacts(profile.uri, kind, lang),
      fetchDbpediaAbstractQuick(profile.uri, lang),
    ])

    const mergedFacts = mergeProfileFacts([...profile.facts, ...facetFacts])
    const longSummary = dbpediaAbstract || profile.longSummary || wiki?.leadText?.trim()
    const abstractSource = dbpediaAbstract ? ('dbpedia' as const) : profile.abstractSource

    const sourcesUsed = [...new Set([...profile.sourcesUsed, ...mergedFacts.map((f) => f.source)])]

    enrichedProfile = {
      ...profile,
      kind,
      facts: mergedFacts,
      factsByGroup: groupProfileFacts(mergedFacts),
      longSummary,
      abstractSource,
      sourcesUsed,
    }
  }

  const sitelink = wiki
    ? { title: wiki.title, lang: wiki.lang, url: wiki.url }
    : null

  let leadWiki = wiki
  if (wiki?.title && (wiki.leadParagraphs?.length ?? 0) <= 1) {
    const intro = await fetchWikipediaIntroParagraphs(wiki.title, wiki.lang)
    if (intro.length) {
      leadWiki = {
        ...wiki,
        leadParagraphs: intro,
        leadText: wiki.leadText || intro[0],
        sectionToc: wiki.sectionToc ?? [],
      }
    }
  }

  const article = await buildEntityArticle(enrichedProfile, lang, {
    includeSections,
    includeTables,
    sitelink,
    leadWiki,
  })

  if (fetchSupplement && article.wikipediaTitle) {
    const supplement = await fetchWikipediaSupplement(article.wikipediaTitle, article.language)
    article.externalLinks = supplement.externalLinks
    article.categories = supplement.categories
  }

  const enriched: CardShell = {
    profile: enrichedProfile,
    article,
    wiki,
  }
  CACHE.set(cacheKey, { at: Date.now(), shell: enriched })
  return enriched
}

export function invalidateEntityCardCache(uri?: string): void {
  if (!uri) {
    CACHE.clear()
    return
  }
  const key = normalizeUri(uri)
  for (const k of CACHE.keys()) {
    if (k.startsWith(key)) CACHE.delete(k)
  }
}
