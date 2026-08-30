import type { EntityKind } from '../../types/entityArticle'
import type { EntityTab } from '../EntityHeader'

export type CategorySectionId =
  | 'profile'
  | 'summary'
  | 'details'
  | 'financials'
  | 'history'
  | 'career'
  | 'works'
  | 'cast'
  | 'honours'
  | 'timeline'
  | 'family'

export type CategoryNavItem = {
  id: CategorySectionId
  label: string
  icon: string
  targetId: string
}

export type LensNavItem = {
  id: EntityTab
  label: string
  icon: string
}

const PERSON_SECTIONS: CategoryNavItem[] = [
  { id: 'profile', label: 'Profile', icon: '◉', targetId: 'cat-profile' },
  { id: 'summary', label: 'AI Summary', icon: '✦', targetId: 'cat-summary' },
  { id: 'details', label: 'Personal Details', icon: '▣', targetId: 'cat-details' },
  { id: 'career', label: 'Career', icon: '↗', targetId: 'cat-career' },
  { id: 'works', label: 'Films & Works', icon: '▦', targetId: 'cat-works' },
  { id: 'honours', label: 'Honours', icon: '★', targetId: 'cat-honours' },
  { id: 'timeline', label: 'Timeline', icon: '◇', targetId: 'cat-timeline' },
  { id: 'family', label: 'Family', icon: '◎', targetId: 'cat-family' },
]

const ORG_SECTIONS: CategoryNavItem[] = [
  { id: 'profile', label: 'Profile', icon: '◉', targetId: 'cat-profile' },
  { id: 'summary', label: 'AI Summary', icon: '✦', targetId: 'cat-summary' },
  { id: 'financials', label: 'Financials', icon: '◈', targetId: 'cat-financials' },
  { id: 'history', label: 'Company History', icon: '◇', targetId: 'cat-history' },
  { id: 'details', label: 'Business Segments', icon: '▣', targetId: 'cat-products' },
  { id: 'honours', label: 'Honours', icon: '★', targetId: 'cat-honours' },
]

const WORK_SECTIONS: CategoryNavItem[] = [
  { id: 'profile', label: 'Profile', icon: '◉', targetId: 'cat-profile' },
  { id: 'summary', label: 'AI Summary', icon: '✦', targetId: 'cat-summary' },
  { id: 'details', label: 'Film Details', icon: '▣', targetId: 'cat-details' },
  { id: 'cast', label: 'Cast', icon: '◎', targetId: 'cat-cast' },
  { id: 'honours', label: 'Awards', icon: '★', targetId: 'cat-honours' },
  { id: 'timeline', label: 'Timeline', icon: '◇', targetId: 'cat-timeline' },
]

export function categorySections(kind: EntityKind): CategoryNavItem[] {
  if (kind === 'person') return PERSON_SECTIONS
  if (kind === 'org') return ORG_SECTIONS
  if (kind === 'work') return WORK_SECTIONS
  return []
}

export function lensNavItems(kind: EntityKind): LensNavItem[] {
  const items: LensNavItem[] = [
    { id: 'graph', label: 'Knowledge Graph', icon: '⬡' },
    { id: 'timeline', label: 'Full Timeline', icon: '▤' },
    { id: 'compare', label: 'Compare', icon: '⇄' },
    { id: 'table', label: 'Table', icon: '▦' },
    { id: 'evidence', label: 'Evidence', icon: '↗' },
  ]
  if (kind === 'person') {
    items.splice(1, 0, { id: 'family', label: 'Family Tree', icon: '◎' })
    items.splice(2, 0, { id: 'business', label: 'Business', icon: '▣' })
    items.splice(3, 0, { id: 'music', label: 'Music', icon: '♪' })
    items.splice(4, 0, { id: 'places', label: 'Places', icon: '⌖' })
  }
  if (kind === 'org') {
    items.splice(1, 0, { id: 'business', label: 'Business', icon: '▣' })
    items.splice(2, 0, { id: 'places', label: 'Places', icon: '⌖' })
  }
  if (kind === 'work') {
    items.splice(1, 0, { id: 'movie', label: 'Movie Graph', icon: '🎬' })
  }
  return items
}

export function scrollToCategorySection(targetId: string) {
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
