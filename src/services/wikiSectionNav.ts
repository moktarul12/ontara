import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'
import type { OverviewSectionDef } from './overviewSections'
import { cleanWikiSectionTitle, normalizeSectionParagraphs } from '../utils/sectionParagraphs'

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
      ((s.paragraphs?.length ?? 0) > 0 || s.children.length > 0 || (s.tables?.length ?? 0) > 0),
  )
}

export function hasWikiChapterNav(dossier: EntityDossier): boolean {
  const lead = dossier.wikipedia?.leadText?.trim()
  return Boolean((lead && lead.length > 40) || topLevelWikiSections(dossier).length > 0)
}

function syntheticIntroductionSection(dossier: EntityDossier): ArticleSection | undefined {
  const lead = dossier.wikipedia?.leadText?.trim()
  if (!lead || lead.length < 40) return undefined
  return {
    id: 'introduction',
    title: 'Introduction',
    level: 2,
    paragraphs: normalizeSectionParagraphs([lead]),
    prose: lead,
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
      navLabel: 'Introduction',
      icon: '¶',
      group: 'wiki',
      title: 'Introduction',
      description: 'Opening summary — editorial rewrite of the Wikipedia lead',
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
        const preview = first ? normalizeSectionParagraphs([first])[0] : undefined
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
