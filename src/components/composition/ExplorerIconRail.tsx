import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'

type RailItem = {
  id: string
  icon: string
  label: string
  scrollId?: string
  sectionId?: OverviewSectionId
  visible: (dossier: EntityDossier) => boolean
}

function railItems(kind: EntityKind): RailItem[] {
  const base: RailItem[] = [
    {
      id: 'overview',
      icon: '◉',
      label: 'Overview',
      scrollId: 'ke-section-overview',
      sectionId: 'summary',
      visible: () => true,
    },
    {
      id: 'timeline',
      icon: '⏱',
      label: 'Timeline',
      scrollId: 'ke-section-timeline',
      sectionId: 'timeline',
      visible: (d) => {
        if (kind === 'person') return buildPersonDashboardData(d).timeline.length > 0
        if (kind === 'org') return buildOrgDashboardData(d).timeline.length > 0
        if (kind === 'work') return buildWorkDashboardData(d).timeline.length > 0
        return d.life.timeline.length > 0
      },
    },
    {
      id: 'media',
      icon: '▦',
      label: kind === 'work' ? 'Cast' : 'Media',
      scrollId: kind === 'work' ? 'cat-cast' : 'cat-works',
      sectionId: kind === 'work' ? 'cast' : 'works',
      visible: (d) => {
        if (kind === 'work') return buildWorkDashboardData(d).cast.length > 0
        if (kind === 'person') return d.summary.topWorks.length > 0
        if (kind === 'org') return buildOrgDashboardData(d).products.length > 0
        return d.works.items.length > 0
      },
    },
    {
      id: 'awards',
      icon: '★',
      label: 'Awards',
      scrollId: 'cat-honours',
      sectionId: 'honours',
      visible: (d) => d.summary.topAwards.length > 0 || d.awards.won.length > 0,
    },
    {
      id: 'relationships',
      icon: '◎',
      label: 'Relationships',
      scrollId: 'ke-rail-relationships',
      sectionId: 'family',
      visible: (d) => d.family.members.length > 0,
    },
    {
      id: 'article',
      icon: '📖',
      label: 'Article',
      scrollId: 'or-chapters',
      sectionId: 'article',
      visible: (d) => (d.wikipedia?.sections.length ?? 0) > 0,
    },
    {
      id: 'sources',
      icon: '↗',
      label: 'Sources',
      sectionId: 'sources',
      visible: () => true,
    },
  ]
  return base
}

export function ExplorerIconRail({
  kind,
  dossier,
  isHome,
  activeSection,
  onSection,
}: {
  kind: EntityKind
  dossier: EntityDossier
  isHome: boolean
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
}) {
  const items = railItems(kind).filter((item) => item.visible(dossier))

  const handleClick = (item: RailItem) => {
    if (isHome && item.scrollId) {
      document.getElementById(item.scrollId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (item.sectionId) onSection(item.sectionId)
    else if (item.scrollId) {
      onSection('summary')
      requestAnimationFrame(() => {
        document.getElementById(item.scrollId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }

  const isActive = (item: RailItem) => {
    if (isHome) return item.id === 'overview'
    if (item.sectionId) return activeSection === item.sectionId
    return false
  }

  return (
    <nav className="ke-icon-rail" aria-label="Page navigation">
      <ul className="ke-icon-rail-list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`ke-icon-rail-btn ${isActive(item) ? 'active' : ''}`}
              onClick={() => handleClick(item)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive(item) ? 'true' : undefined}
            >
              <span className="ke-icon-rail-glyph" aria-hidden>
                {item.icon}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
