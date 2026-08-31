import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'
import type { OverviewSectionDef } from './overviewSections'
import type { WikipediaSectionTocEntry } from './wikipediaArticle'
import { cleanWikiSectionTitle, cleanWikiParagraphText } from '../utils/sectionParagraphs'
import { resolveArticleLeadParagraphs } from '../utils/dossierNarrative'

export function wikiSlugId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Wikipedia section headings for instant "On this page" nav (bodies load later). */
export function wikiTocToArticleSections(toc: WikipediaSectionTocEntry[]): ArticleSection[] {
  return toc
    .filter((s) => s.level === 2)
    .map((s) => ({
      id: wikiSlugId(s.anchor || s.title),
      title: s.title,
      level: 2 as const,
      paragraphs: [],
      prose: '',
      children: [],
      source: 'wikipedia' as const,
    }))
}

/** Dynamic wiki chapter route, e.g. w/early-life-and-family */
export type WikiSectionNavId = `w/${string}`

export function isWikiSectionId(id: string): id is WikiSectionNavId {
  return id.startsWith('w/')
}

export function wikiSectionNavId(section: ArticleSection): WikiSectionNavId {
  return `w/${section.id}`
}

const INTRO_ID: WikiSectionNavId = 'w/introduction'

export function topLevelWikiSections(dossier: EntityDossier): ArticleSection[] {
  const sections = dossier.wikipedia?.sections ?? []
  return sections.filter(
    (s) =>
      s.level === 2 &&
      ((s.paragraphs?.length ?? 0) > 0 ||
        s.children.length > 0 ||
        (s.tables?.length ?? 0) > 0 ||
        s.source === 'wikipedia'),
  )
}

export function hasWikiChapterNav(dossier: EntityDossier): boolean {
  const lead = resolveArticleLeadParagraphs(dossier)[0]
  return Boolean((lead && lead.length > 40) || topLevelWikiSections(dossier).length > 0)
}

function syntheticIntroductionSection(dossier: EntityDossier): ArticleSection | undefined {
  const paragraphs = resolveArticleLeadParagraphs(dossier)
    .map(cleanWikiParagraphText)
    .filter((p) => p.length > 12)
  if (!paragraphs.length || paragraphs[0].length < 40) return undefined
  return {
    id: 'introduction',
    title: 'Introduction',
    level: 2,
    paragraphs,
    prose: paragraphs.join('\n\n'),
    children: [],
    source: 'wikipedia',
  }
}

/** Resolve a wiki nav id to an article section (including synthetic introduction). */
export function findWikiSectionByNavId(
  dossier: EntityDossier,
  id: WikiSectionNavId,
): ArticleSection | undefined {
  if (id === INTRO_ID) return syntheticIntroductionSection(dossier)

  const slug = id.slice(2)
  const walk = (sections: ArticleSection[]): ArticleSection | undefined => {
    for (const s of sections) {
      if (s.id === slug) return s
      const hit = walk(s.children)
      if (hit) return hit
    }
    return undefined
  }
  return walk(dossier.wikipedia?.sections ?? [])
}

export function wikiSectionNavDefs(dossier: EntityDossier): OverviewSectionDef[] {
  const defs: OverviewSectionDef[] = []
  const intro = syntheticIntroductionSection(dossier)
  if (intro) {
    defs.push({
      id: INTRO_ID,
      navLabel: 'Overview',
      icon: '¶',
      group: 'wiki',
      title: 'Introduction',
      description: 'Opening summary from the Wikipedia lead',
      previewHint: () => `${intro.paragraphs?.[0]?.slice(0, 90)}…`,
    })
  }

  for (const section of topLevelWikiSections(dossier)) {
    const navId = wikiSectionNavId(section)
    const subCount = section.children.length
    defs.push({
      id: navId,
      navLabel: section.title.replace(/\s*\[edit\]\s*$/i, ''),
      icon: '§',
      group: 'wiki',
      title: cleanWikiSectionTitle(section.title),
      description: `Wikipedia chapter${subCount ? ` · ${subCount} subsections` : ''}`,
      previewHint: (d) => {
        const s = findWikiSectionByNavId(d, navId)
        const first = s?.paragraphs?.[0]
        const preview = first ? cleanWikiParagraphText(first) : undefined
        return preview && preview.length > 30 ? `${preview.slice(0, 88)}…` : undefined
      },
    })
  }

  return defs
}

export function wikiSectionParagraphCount(section: ArticleSection): number {
  let n = section.paragraphs?.length ?? 0
  for (const c of section.children) n += wikiSectionParagraphCount(c)
  return n
}

export function adjacentWikiSections(
  dossier: EntityDossier,
  current: WikiSectionNavId,
): { prev?: OverviewSectionDef; next?: OverviewSectionDef } {
  const all = wikiSectionNavDefs(dossier)
  const idx = all.findIndex((s) => s.id === current)
  if (idx < 0) return {}
  return { prev: all[idx - 1], next: all[idx + 1] }
}
