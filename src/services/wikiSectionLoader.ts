import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'
import {
  fetchWikipediaSectionTree,
  type WikipediaSectionRaw,
  type WikipediaSectionTocEntry,
} from './wikipediaArticle'
import { findWikiSectionByNavId, type WikiSectionNavId } from './wikiSectionNav'
import { wikiSlugId } from './wikiSectionNav'

const LOADED = new Map<string, ArticleSection>()

function cacheKey(lang: string, page: string, slug: string): string {
  return `${lang}|${page}|${slug}`
}

function wikipediaPageTitle(dossier: EntityDossier): string | undefined {
  if (!dossier.wikipediaUrl) return undefined
  try {
    const last = new URL(dossier.wikipediaUrl).pathname.split('/').pop()
    if (!last) return undefined
    return decodeURIComponent(last.replace(/_/g, ' '))
  } catch {
    return undefined
  }
}

function rawToArticleSection(
  s: WikipediaSectionRaw & { children?: WikipediaSectionRaw[] },
): ArticleSection {
  const children = (s.children ?? []).map(rawToArticleSection)
  return {
    id: wikiSlugId(s.anchor || s.title),
    title: s.title,
    level: s.level,
    paragraphs: s.paragraphs,
    prose: s.paragraphs.join('\n\n'),
    source: 'wikipedia',
    children,
    tables: [],
  }
}

function sectionHasBody(section: ArticleSection | undefined): boolean {
  if (!section) return false
  if ((section.paragraphs?.length ?? 0) > 0) return true
  return section.children.some((c) => sectionHasBody(c))
}

function mergeSectionTree(sections: ArticleSection[], loaded: ArticleSection): ArticleSection[] {
  return sections.map((s) => {
    if (s.id === loaded.id) return loaded
    if (s.children.length) return { ...s, children: mergeSectionTree(s.children, loaded) }
    return s
  })
}

export function mergeWikiSectionIntoDossier(
  dossier: EntityDossier,
  loaded: ArticleSection,
): EntityDossier {
  if (!dossier.wikipedia) return dossier
  return {
    ...dossier,
    wikipedia: {
      ...dossier.wikipedia,
      sections: mergeSectionTree(dossier.wikipedia.sections, loaded),
    },
  }
}

export function dossierSectionToc(dossier: EntityDossier): WikipediaSectionTocEntry[] {
  return dossier.wikipedia?.sectionToc ?? []
}

/** Fetch one top-level Wikipedia chapter (h2) and its subsections on demand. */
export async function loadWikiSectionForNav(
  dossier: EntityDossier,
  navId: WikiSectionNavId,
): Promise<ArticleSection | null> {
  if (navId === 'w/introduction') return null

  const slug = navId.slice(2)
  const existing = findWikiSectionByNavId(dossier, navId)
  if (sectionHasBody(existing)) return existing ?? null

  const page = wikipediaPageTitle(dossier)
  const lang = dossier.language || 'en'
  const toc = dossierSectionToc(dossier)
  if (!page || !toc.length) return null

  const hit = LOADED.get(cacheKey(lang, page, slug))
  if (hit) return hit

  const tree = await fetchWikipediaSectionTree(lang, page, toc, slug)
  if (!tree) return null

  const article = rawToArticleSection(tree)
  LOADED.set(cacheKey(lang, page, slug), article)
  return article
}
