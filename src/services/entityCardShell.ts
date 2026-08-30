import type { EntityArticle, EntityKind } from '../types/entityArticle'
import type { EntityProfile, ProfileFact } from './entityProfile'
import {
  groupProfileFacts,
  mergeProfileFacts,
} from './entityProfile'
import { buildInfobox } from './infoboxBuilder'
import { claimFactsToInfobox } from './wikidataClaims'
import { fetchWikidataClaimFacts, qidFromUri } from './wikidataClaims'
import { fetchWikipediaLead, fetchWikipediaSitelink } from './wikipediaArticle'
import { WIKIDATA_ENDPOINT } from '../types/ontology'
import * as wd from './wikidata'
import { fetchKindFacetFacts, fetchDbpediaAbstractQuick } from './entityProfile'
import { fetchWikidataP18Image, upscaleWikiThumb } from './entityImages'
import { buildEntityArticle } from './articleBuilder'
import { fetchWikipediaSupplement } from './wikipediaArticle'

export type CardShell = {
  profile: EntityProfile
  article: EntityArticle
  wiki: Awaited<ReturnType<typeof fetchWikipediaLead>> | null
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
    sections: [],
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

  const [claims, kind, imageUrl, sitelink, apiImage] = await Promise.all([
    fetchWikidataClaimFacts(wdUri, lang),
    wd.wdEntityKind(WIKIDATA_ENDPOINT, wdUri),
    wd.wdEntityImage(WIKIDATA_ENDPOINT, wdUri, 480),
    fetchWikipediaSitelink(wdUri, lang),
    fetchWikidataP18Image(wdUri, 480),
  ])

  const wiki = sitelink ? await fetchWikipediaLead(sitelink.title, sitelink.lang) : null
  const heroImage =
    apiImage ?? imageUrl ?? upscaleWikiThumb(wiki?.leadImage, 480) ?? undefined

  const entityKind: EntityProfile['kind'] =
    kind === 'other' ? 'other' : (kind as EntityProfile['kind'])

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

/** Background enrich: facet SPARQL + DBpedia abstract (no Wikipedia sections). */
export async function enrichEntityCardShell(
  shell: CardShell,
  lang: string,
): Promise<CardShell> {
  const { profile, wiki } = shell
  const cacheKey = `${profile.uri}|${lang}|enriched`
  const hit = CACHE.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.shell

  const [facetFacts, dbpediaAbstract] = await Promise.all([
    fetchKindFacetFacts(profile.uri, profile.kind, lang),
    fetchDbpediaAbstractQuick(profile.uri, lang),
  ])

  const mergedFacts = mergeProfileFacts([...profile.facts, ...facetFacts])
  const longSummary = dbpediaAbstract || profile.longSummary || wiki?.leadText?.trim()
  const abstractSource = dbpediaAbstract ? ('dbpedia' as const) : profile.abstractSource

  const sourcesUsed = [...new Set([...profile.sourcesUsed, ...mergedFacts.map((f) => f.source)])]

  const enrichedProfile: EntityProfile = {
    ...profile,
    facts: mergedFacts,
    factsByGroup: groupProfileFacts(mergedFacts),
    longSummary,
    abstractSource,
    sourcesUsed,
  }

  const article = await buildEntityArticle(enrichedProfile, lang, {
    includeSections: true,
    includeTables: true,
  })

  if (article.wikipediaTitle) {
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
