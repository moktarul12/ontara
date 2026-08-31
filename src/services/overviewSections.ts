import type { EntityKind } from '../types/entityArticle'
import type { ArticleSection } from '../types/entityArticle'
import type { EntityDossier } from '../types/entityDossier'
import { buildOrgDashboardData } from './orgDashboardBuilder'
import { buildPersonDashboardData } from './personDashboardBuilder'
import { buildWorkDashboardData } from './workDashboardBuilder'
import { corpusTimelineCount } from './corpusTimelineBuilder'

import {
  findWikiSectionByNavId,
  hasWikiChapterNav,
  isWikiSectionId,
  wikiSectionNavDefs,
  wikiSectionParagraphCount,
} from './wikiSectionNav'

export type FixedOverviewSectionId =
  | 'summary'
  | 'infobox'
  | 'article'
  | 'facts'
  | 'ai'
  | 'details'
  | 'career'
  | 'works'
  | 'filmography'
  | 'plot'
  | 'honours'
  | 'timeline'
  | 'family'
  | 'financials'
  | 'products'
  | 'leadership'
  | 'history'
  | 'cast'
  | 'related'
  | 'external'
  | 'sources'

/** Fixed section ids plus dynamic Wikipedia chapter routes (w/section-slug). */
export type OverviewSectionId = FixedOverviewSectionId | `w/${string}`

export type OverviewSectionGroup = 'summary' | 'learn' | 'wiki'

export type OverviewSectionDef = {
  id: OverviewSectionId
  navLabel: string
  icon: string
  group: OverviewSectionGroup
  title: string
  description: string
  previewHint?: (dossier: EntityDossier) => string | undefined
}

type SectionVisibility = (dossier: EntityDossier) => boolean
type SectionCount = (dossier: EntityDossier) => number | undefined

function walkWikiSections(sections: ArticleSection[], fn: (s: ArticleSection) => boolean): boolean {
  for (const s of sections) {
    if (fn(s)) return true
    if (s.children.length && walkWikiSections(s.children, fn)) return true
  }
  return false
}

function wikiHasSection(dossier: EntityDossier, pattern: RegExp): boolean {
  if (!dossier.wikipedia?.sections.length) return false
  return walkWikiSections(dossier.wikipedia.sections, (s) => pattern.test(s.title))
}

const PERSON_SECTIONS: OverviewSectionDef[] = [
  {
    id: 'summary',
    navLabel: 'Overview',
    icon: '◉',
    group: 'summary',
    title: 'Overview',
    description: 'Summary and key highlights',
  },
  {
    id: 'infobox',
    navLabel: 'Infobox',
    icon: '▤',
    group: 'learn',
    title: 'Infobox',
    description: 'Wikipedia-style structured facts',
    previewHint: (d) => {
      const n = d.wikipedia?.infobox.length
      return n ? `${n} fields` : undefined
    },
  },
  {
    id: 'article',
    navLabel: 'Full Article',
    icon: '📖',
    group: 'learn',
    title: 'Wikipedia Article',
    description: 'Complete article sections from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.sections.length
      return n ? `${n} sections` : undefined
    },
  },
  {
    id: 'ai',
    navLabel: 'AI Summary',
    icon: '✦',
    group: 'learn',
    title: 'Understand in 30 seconds',
    description: 'AI-assisted narrative from verified facts',
    previewHint: (d) =>
      d.categoryContent?.sections?.some((s) => s.narrative) || d.summary.storyParagraph
        ? 'Full narrative'
        : undefined,
  },
  {
    id: 'facts',
    navLabel: 'Key Facts',
    icon: '▣',
    group: 'learn',
    title: 'Key Facts',
    description: 'Verified highlights at a glance',
    previewHint: (d) => {
      const n = buildPersonDashboardData(d).highlights.length || d.summary.storyBeats.length
      return n ? `${n} highlights` : undefined
    },
  },
  {
    id: 'details',
    navLabel: 'Personal Details',
    icon: '☰',
    group: 'learn',
    title: 'Personal Details',
    description: 'Structured facts from Wikidata, Wikipedia & DBpedia',
    previewHint: (d) => {
      const n = buildPersonDashboardData(d).detailCards.length
      return n ? `${n} properties` : undefined
    },
  },
  {
    id: 'career',
    navLabel: 'Career',
    icon: '↗',
    group: 'learn',
    title: 'Career Phases',
    description: 'Professional journey and eras',
    previewHint: (d) => {
      const n = d.summary.careerEras.length
      return n ? `${n} phases` : undefined
    },
  },
  {
    id: 'works',
    navLabel: 'Films & Works',
    icon: '▦',
    group: 'learn',
    title: 'Notable Works',
    description: 'Films, books, and creative output',
    previewHint: (d) => {
      const n = d.summary.topWorks.length || d.works.totalCount
      return n ? `${n} works` : undefined
    },
  },
  {
    id: 'filmography',
    navLabel: 'Filmography',
    icon: '▦',
    group: 'learn',
    title: 'Filmography',
    description: 'Complete filmography from Wikipedia & Wikidata',
    previewHint: (d) => {
      const n = d.works.totalCount
      return n > 5 ? `${n} credits` : undefined
    },
  },
  {
    id: 'honours',
    navLabel: 'Honours',
    icon: '★',
    group: 'learn',
    title: 'Honours & Awards',
    description: 'Recognition and achievements',
    previewHint: (d) => {
      const n = d.summary.topAwards.length
      return n ? `${n} awards` : undefined
    },
  },
  {
    id: 'timeline',
    navLabel: 'Timeline',
    icon: '◇',
    group: 'learn',
    title: 'Life Timeline',
    description: 'Key dates across life and career',
    previewHint: (d) => {
      const n = buildPersonDashboardData(d).timeline.length
      return n ? `${n} events` : undefined
    },
  },
  {
    id: 'family',
    navLabel: 'Family',
    icon: '◎',
    group: 'learn',
    title: 'Family & Relationships',
    description: 'Close relations and connections',
    previewHint: (d) => {
      const n = d.family.members.length
      return n ? `${n} members` : undefined
    },
  },
  {
    id: 'related',
    navLabel: 'Related',
    icon: '⬡',
    group: 'learn',
    title: 'Related Knowledge',
    description: 'Connected people, works, and entities',
  },
  {
    id: 'external',
    navLabel: 'External Links',
    icon: '↗',
    group: 'learn',
    title: 'External Links',
    description: 'Official sites and references from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.externalLinks.length
      return n ? `${n} links` : undefined
    },
  },
  {
    id: 'sources',
    navLabel: 'Sources',
    icon: '↗',
    group: 'learn',
    title: 'Sources & Provenance',
    description: 'Trace facts back to their origin',
    previewHint: (d) => {
      const n = d.sources.length
      return n ? `${n} references` : undefined
    },
  },
]

const ORG_SECTIONS: OverviewSectionDef[] = [
  {
    id: 'summary',
    navLabel: 'Overview',
    icon: '◉',
    group: 'summary',
    title: 'Overview',
    description: 'Company summary and highlights',
  },
  {
    id: 'infobox',
    navLabel: 'Infobox',
    icon: '▤',
    group: 'learn',
    title: 'Infobox',
    description: 'Wikipedia-style company facts',
    previewHint: (d) => {
      const n = d.wikipedia?.infobox.length
      return n ? `${n} fields` : undefined
    },
  },
  {
    id: 'article',
    navLabel: 'Full Article',
    icon: '📖',
    group: 'learn',
    title: 'Wikipedia Article',
    description: 'Complete article from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.sections.length
      return n ? `${n} sections` : undefined
    },
  },
  {
    id: 'ai',
    navLabel: 'AI Summary',
    icon: '✦',
    group: 'learn',
    title: 'Understand in 30 seconds',
    description: 'AI-assisted company narrative',
  },
  {
    id: 'facts',
    navLabel: 'Company Facts',
    icon: '▣',
    group: 'learn',
    title: 'Company Facts',
    description: 'Key metrics and highlights',
    previewHint: (d) => {
      const n = buildOrgDashboardData(d).highlights.length
      return n ? `${n} highlights` : undefined
    },
  },
  {
    id: 'details',
    navLabel: 'Company Details',
    icon: '☰',
    group: 'learn',
    title: 'Company Details',
    description: 'Industry, headquarters, and corporate facts',
    previewHint: (d) => {
      const n = d.wikipedia?.infobox.length ?? d.summary.verifiedFacts.length
      return n ? `${n} properties` : undefined
    },
  },
  {
    id: 'financials',
    navLabel: 'Financials',
    icon: '◈',
    group: 'learn',
    title: 'Financial Overview',
    description: 'Revenue, employees, and market data',
    previewHint: (d) => {
      const data = buildOrgDashboardData(d)
      const n = data.financialPoints.length + data.heroMetrics.filter((m) => /revenue|income|cap|employees/i.test(m.label)).length
      return n ? `${n} figures` : undefined
    },
  },
  {
    id: 'products',
    navLabel: 'Products',
    icon: '▦',
    group: 'learn',
    title: 'Products & Segments',
    description: 'Business areas and brands',
    previewHint: (d) => {
      const n = buildOrgDashboardData(d).products.length
      return n ? `${n} segments` : undefined
    },
  },
  {
    id: 'leadership',
    navLabel: 'Leadership',
    icon: '◎',
    group: 'learn',
    title: 'Leadership',
    description: 'Executives and key people',
    previewHint: (d) => {
      const n = buildOrgDashboardData(d).keyPeople.length
      return n ? `${n} people` : undefined
    },
  },
  {
    id: 'history',
    navLabel: 'History',
    icon: '◇',
    group: 'learn',
    title: 'Company History',
    description: 'Founding, milestones, and timeline',
    previewHint: (d) => {
      const n = buildOrgDashboardData(d).timeline.length
      return n ? `${n} events` : undefined
    },
  },
  {
    id: 'honours',
    navLabel: 'Honours',
    icon: '★',
    group: 'learn',
    title: 'Honours',
    description: 'Awards and recognition',
    previewHint: (d) => {
      const n = d.summary.topAwards.length
      return n ? `${n} awards` : undefined
    },
  },
  {
    id: 'related',
    navLabel: 'Related',
    icon: '⬡',
    group: 'learn',
    title: 'Related Companies',
    description: 'Connected organizations and entities',
  },
  {
    id: 'external',
    navLabel: 'External Links',
    icon: '↗',
    group: 'learn',
    title: 'External Links',
    description: 'Official sites and references from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.externalLinks.length
      return n ? `${n} links` : undefined
    },
  },
  {
    id: 'sources',
    navLabel: 'Sources',
    icon: '↗',
    group: 'learn',
    title: 'Sources & Provenance',
    description: 'Trace facts back to their origin',
  },
]

const WORK_SECTIONS: OverviewSectionDef[] = [
  {
    id: 'summary',
    navLabel: 'Overview',
    icon: '◉',
    group: 'summary',
    title: 'Overview',
    description: 'Film summary and highlights',
  },
  {
    id: 'infobox',
    navLabel: 'Infobox',
    icon: '▤',
    group: 'learn',
    title: 'Infobox',
    description: 'Wikipedia film infobox',
    previewHint: (d) => {
      const n = d.wikipedia?.infobox.length
      return n ? `${n} fields` : undefined
    },
  },
  {
    id: 'article',
    navLabel: 'Full Article',
    icon: '📖',
    group: 'learn',
    title: 'Wikipedia Article',
    description: 'Complete article from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.sections.length
      return n ? `${n} sections` : undefined
    },
  },
  {
    id: 'plot',
    navLabel: 'Plot',
    icon: '📝',
    group: 'learn',
    title: 'Plot & Story',
    description: 'Synopsis from Wikipedia',
    previewHint: () => 'From Wikipedia',
  },
  {
    id: 'ai',
    navLabel: 'AI Summary',
    icon: '✦',
    group: 'learn',
    title: 'Understand in 30 seconds',
    description: 'AI-assisted story summary',
  },
  {
    id: 'facts',
    navLabel: 'Movie Facts',
    icon: '▣',
    group: 'learn',
    title: 'Movie Facts',
    description: 'Key stats and story beats',
    previewHint: (d) => {
      const data = buildWorkDashboardData(d)
      const n = data.keyStats.length + d.summary.storyBeats.length
      return n ? `${n} facts` : undefined
    },
  },
  {
    id: 'details',
    navLabel: 'Film Details',
    icon: '☰',
    group: 'learn',
    title: 'Film Details',
    description: 'Release, runtime, language, and more',
    previewHint: (d) => {
      const n = buildWorkDashboardData(d).detailCards.length
      return n ? `${n} properties` : undefined
    },
  },
  {
    id: 'cast',
    navLabel: 'Cast & Crew',
    icon: '◎',
    group: 'learn',
    title: 'Cast & Crew',
    description: 'Principal cast from linked sources',
    previewHint: (d) => {
      const n = buildWorkDashboardData(d).cast.length
      return n ? `${n} cast` : undefined
    },
  },
  {
    id: 'honours',
    navLabel: 'Awards',
    icon: '★',
    group: 'learn',
    title: 'Awards & Recognition',
    description: 'Festivals, nominations, and wins',
    previewHint: (d) => {
      const n = d.summary.topAwards.length
      return n ? `${n} awards` : undefined
    },
  },
  {
    id: 'timeline',
    navLabel: 'Timeline',
    icon: '◇',
    group: 'learn',
    title: 'Timeline',
    description: 'Release and milestone dates',
    previewHint: (d) => {
      const n = buildWorkDashboardData(d).timeline.length
      return n ? `${n} events` : undefined
    },
  },
  {
    id: 'related',
    navLabel: 'Related',
    icon: '⬡',
    group: 'learn',
    title: 'Related Knowledge',
    description: 'Connected films, people, and entities',
  },
  {
    id: 'external',
    navLabel: 'External Links',
    icon: '↗',
    group: 'learn',
    title: 'External Links',
    description: 'Official sites and references from Wikipedia',
    previewHint: (d) => {
      const n = d.wikipedia?.externalLinks.length
      return n ? `${n} links` : undefined
    },
  },
  {
    id: 'sources',
    navLabel: 'Sources',
    icon: '↗',
    group: 'learn',
    title: 'Sources & Provenance',
    description: 'Trace facts back to their origin',
  },
]

const VISIBILITY: Record<OverviewSectionId, SectionVisibility> = {
  summary: () => true,
  infobox: (d) => (d.wikipedia?.infobox.length ?? 0) > 0,
  article: (d) => !hasWikiChapterNav(d) && (d.wikipedia?.sections.length ?? 0) > 0,
  plot: (d) =>
    d.kind === 'work' &&
    (wikiHasSection(d, /plot|synopsis|story|premise/i) ||
      Boolean(d.wikipedia?.leadText && d.wikipedia.leadText.length > 280)),
  external: (d) => (d.wikipedia?.externalLinks.length ?? 0) > 0,
  filmography: (d) => d.kind === 'person' && d.works.totalCount > 5,
  ai: () => false,
  facts: (d) => {
    if (d.kind === 'person') {
      const data = buildPersonDashboardData(d)
      return data.highlights.length > 0 || d.summary.storyBeats.length > 0
    }
    if (d.kind === 'org') return buildOrgDashboardData(d).highlights.length > 0
    if (d.kind === 'work') {
      const data = buildWorkDashboardData(d)
      return data.keyStats.length > 0 || d.summary.storyBeats.length > 0
    }
    return false
  },
  details: (d) => {
    if (d.kind === 'person') return buildPersonDashboardData(d).detailCards.length > 0
    if (d.kind === 'work') return buildWorkDashboardData(d).detailCards.length > 0
    if (d.kind === 'org') {
      return (d.wikipedia?.infobox.length ?? 0) > 0 || d.summary.verifiedFacts.length > 0
    }
    return false
  },
  career: (d) => d.kind === 'person' && d.summary.careerEras.length > 0,
  works: (d) => d.kind === 'person' && d.summary.topWorks.length > 0,
  honours: (d) => d.summary.topAwards.length > 0,
  timeline: (d) => {
    if (d.kind === 'person') return buildPersonDashboardData(d).timeline.length > 0
    if (d.kind === 'org') return buildOrgDashboardData(d).timeline.length > 0
    if (d.kind === 'work') return buildWorkDashboardData(d).timeline.length > 0
    return false
  },
  family: (d) => d.kind === 'person' && d.family.members.length > 0,
  financials: (d) => {
    if (d.kind !== 'org') return false
    const data = buildOrgDashboardData(d)
    return (
      data.financialPoints.length > 0 ||
      data.heroMetrics.some((m) => /revenue|income|cap|employees/i.test(m.label))
    )
  },
  products: (d) => d.kind === 'org' && buildOrgDashboardData(d).products.length > 0,
  leadership: (d) => d.kind === 'org' && buildOrgDashboardData(d).keyPeople.length > 0,
  history: (d) => d.kind === 'org' && buildOrgDashboardData(d).timeline.length > 0,
  cast: (d) => d.kind === 'work' && buildWorkDashboardData(d).cast.length > 0,
  related: (d) =>
    d.summary.topWorks.length > 0 ||
    d.family.members.length > 0 ||
    d.summary.familyPreview.length > 0,
  sources: (d) =>
    Boolean(d.wikipediaUrl || d.wikidataUrl || d.summary.website || d.sources.length > 0),
}

const COUNTS: Partial<Record<OverviewSectionId, SectionCount>> = {
  infobox: (d) => d.wikipedia?.infobox.length || undefined,
  article: (d) => d.wikipedia?.sections.length || undefined,
  external: (d) => d.wikipedia?.externalLinks.length || undefined,
  filmography: (d) => (d.kind === 'person' ? d.works.totalCount || undefined : undefined),
  facts: (d) => {
    if (d.kind === 'person') {
      const data = buildPersonDashboardData(d)
      return data.highlights.length || d.summary.storyBeats.length || undefined
    }
    if (d.kind === 'org') return buildOrgDashboardData(d).highlights.length || undefined
    if (d.kind === 'work') {
      const data = buildWorkDashboardData(d)
      return data.keyStats.length + d.summary.storyBeats.length || undefined
    }
    return undefined
  },
  details: (d) => {
    if (d.kind === 'person') return buildPersonDashboardData(d).detailCards.length || undefined
    if (d.kind === 'work') return buildWorkDashboardData(d).detailCards.length || undefined
    if (d.kind === 'org') return d.wikipedia?.infobox.length || d.summary.verifiedFacts.length || undefined
    return undefined
  },
  career: (d) => d.summary.careerEras.length || undefined,
  works: (d) => d.summary.topWorks.length || d.works.totalCount || undefined,
  honours: (d) => d.summary.topAwards.length || undefined,
  timeline: (d) => corpusTimelineCount(d) || undefined,
  family: (d) => d.family.members.length || undefined,
  financials: (d) => {
    if (d.kind !== 'org') return undefined
    const data = buildOrgDashboardData(d)
    const n =
      data.financialPoints.length +
      data.heroMetrics.filter((m) => /revenue|income|cap|employees/i.test(m.label)).length
    return n || undefined
  },
  products: (d) => (d.kind === 'org' ? buildOrgDashboardData(d).products.length || undefined : undefined),
  leadership: (d) => (d.kind === 'org' ? buildOrgDashboardData(d).keyPeople.length || undefined : undefined),
  history: (d) => (d.kind === 'org' ? buildOrgDashboardData(d).timeline.length || undefined : undefined),
  cast: (d) => (d.kind === 'work' ? buildWorkDashboardData(d).cast.length || undefined : undefined),
  sources: (d) => d.sources.length || undefined,
}

const SECTIONS_BY_KIND: Partial<Record<EntityKind, OverviewSectionDef[]>> = {
  person: PERSON_SECTIONS,
  org: ORG_SECTIONS,
  work: WORK_SECTIONS,
}

export function overviewSectionsFor(kind: EntityKind): OverviewSectionDef[] {
  return SECTIONS_BY_KIND[kind] ?? []
}

export function overviewSectionDef(
  kind: EntityKind,
  id: OverviewSectionId,
  dossier?: EntityDossier,
): OverviewSectionDef | undefined {
  if (isWikiSectionId(id) && dossier) {
    return wikiSectionNavDefs(dossier).find((s) => s.id === id)
  }
  return overviewSectionsFor(kind).find((s) => s.id === id)
}

export function isOverviewSectionVisible(dossier: EntityDossier, id: OverviewSectionId): boolean {
  if (isWikiSectionId(id)) {
    return findWikiSectionByNavId(dossier, id) !== undefined
  }
  const fn = VISIBILITY[id as FixedOverviewSectionId]
  return fn ? fn(dossier) : false
}

export function overviewSectionCount(dossier: EntityDossier, id: OverviewSectionId): number | undefined {
  if (isWikiSectionId(id)) {
    const section = findWikiSectionByNavId(dossier, id)
    return section ? wikiSectionParagraphCount(section) : undefined
  }
  const fn = COUNTS[id as FixedOverviewSectionId]
  return fn?.(dossier)
}

export function visibleOverviewSections(
  kind: EntityKind,
  dossier: EntityDossier,
): OverviewSectionDef[] {
  const staticVisible = overviewSectionsFor(kind).filter((s) => isOverviewSectionVisible(dossier, s.id))
  const wiki = wikiSectionNavDefs(dossier)
  return [...staticVisible, ...wiki]
}

export function learnOverviewSections(
  kind: EntityKind,
  dossier: EntityDossier,
): OverviewSectionDef[] {
  return visibleOverviewSections(kind, dossier).filter((s) => s.group === 'learn')
}

export function wikiOverviewSections(
  kind: EntityKind,
  dossier: EntityDossier,
): OverviewSectionDef[] {
  return visibleOverviewSections(kind, dossier).filter((s) => s.group === 'wiki')
}

export function adjacentOverviewSections(
  kind: EntityKind,
  dossier: EntityDossier,
  current: OverviewSectionId,
): { prev?: OverviewSectionDef; next?: OverviewSectionDef } {
  const visible = visibleOverviewSections(kind, dossier).filter((s) => s.id !== 'summary')
  const idx = visible.findIndex((s) => s.id === current)
  if (idx < 0) return {}
  return {
    prev: visible[idx - 1],
    next: visible[idx + 1],
  }
}

export function parseOverviewSectionSlug(slug: string): OverviewSectionId | null {
  if (slug.startsWith('w/')) return slug as OverviewSectionId
  const valid: FixedOverviewSectionId[] = [
    'summary', 'infobox', 'article', 'facts', 'ai', 'details', 'career', 'works', 'filmography',
    'plot', 'honours', 'timeline', 'family', 'financials', 'products', 'leadership', 'history',
    'cast', 'related', 'external', 'sources',
  ]
  return valid.includes(slug as FixedOverviewSectionId) ? (slug as OverviewSectionId) : null
}

/** @deprecated Use overviewSectionsFor */
export function pageDefinitionFor(kind: EntityKind) {
  const sections = overviewSectionsFor(kind)
  if (!sections.length) return undefined
  const labels: Partial<Record<EntityKind, { categoryLabel: string; uxFocus: string }>> = {
    person: { categoryLabel: 'Person', uxFocus: 'Biography · timeline · achievements · relationships' },
    org: { categoryLabel: 'Company', uxFocus: 'Business intelligence · products · leadership · milestones' },
    work: { categoryLabel: 'Film & Media', uxFocus: 'Story · cast · media · awards' },
    place: { categoryLabel: 'Place', uxFocus: 'Map · history · attractions' },
    other: { categoryLabel: 'Entity', uxFocus: 'Knowledge explorer' },
  }
  const meta = labels[kind] ?? { categoryLabel: 'Entity', uxFocus: 'Knowledge explorer' }
  return {
    kind,
    categoryLabel: meta.categoryLabel,
    uxFocus: meta.uxFocus,
    sections: sections.map((s) => ({
      id: s.id,
      component: s.id,
      title: s.title,
      navLabel: s.navLabel,
      targetId: `cat-${s.id}`,
      icon: s.icon,
    })),
  }
}

export function scrollToSection(_targetId: string) {
  // Legacy scroll helper — overview now uses section routing
}
