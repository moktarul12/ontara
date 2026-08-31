import { useMemo } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import { overviewSectionCount, type OverviewSectionId } from '../../services/overviewSections'
import { corpusTimelineCount } from '../../services/corpusTimelineBuilder'
import { buildCorpusDataStats } from '../../services/corpusDataBuilder'

type TopicTab = {
  id: string
  label: string
  icon: string
  sectionId?: OverviewSectionId
  scrollId?: string
  count?: number
}

function buildTabs(kind: EntityKind, dossier: EntityDossier): TopicTab[] {
  const timelineCount = corpusTimelineCount(dossier)
  const timelineSection: OverviewSectionId = kind === 'org' ? 'history' : 'timeline'
  const dataStats = buildCorpusDataStats(dossier)
  const works = dataStats.worksCount || overviewSectionCount(dossier, 'works')
  const awards = dataStats.awardsWon + dataStats.nominations || overviewSectionCount(dossier, 'honours')

  const tabs: TopicTab[] = [
    { id: 'overview', label: 'Overview', icon: '📖', scrollId: 'corpus-reading' },
  ]

  if (timelineCount) {
    tabs.push({
      id: 'timeline',
      label: 'Timeline',
      icon: '⏱',
      sectionId: timelineSection,
      count: timelineCount,
    })
  }

  if (works) {
    tabs.push({
      id: 'works',
      label: kind === 'work' ? 'Cast' : kind === 'org' ? 'Products' : 'Works',
      icon: kind === 'work' ? '👥' : '📚',
      sectionId: kind === 'person' ? 'filmography' : kind === 'work' ? 'cast' : 'products',
      count: works,
    })
  }

  if (awards) {
    tabs.push({
      id: 'awards',
      label: 'Awards',
      icon: '🏆',
      sectionId: 'honours',
      count: awards,
    })
  }

  tabs.push({
    id: 'data',
    label: 'Data',
    icon: '📊',
    sectionId: 'facts',
    count: dataStats.worksCount || undefined,
  })

  return tabs
}

export function CorpusTopicTabs({
  kind,
  dossier,
  activeSection,
  onSection,
}: {
  kind: EntityKind
  dossier: EntityDossier
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
}) {
  const tabs = useMemo(() => buildTabs(kind, dossier), [kind, dossier])
  const onSummary = activeSection === 'summary'

  const handleClick = (tab: TopicTab) => {
    if (tab.id === 'overview') {
      if (!onSummary) onSection('summary')
      requestAnimationFrame(() => {
        document.getElementById(tab.scrollId ?? 'corpus-reading')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      })
      return
    }
    if (onSummary && tab.scrollId) {
      document.getElementById(tab.scrollId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (tab.sectionId) onSection(tab.sectionId)
  }

  const isActive = (tab: TopicTab) => {
    if (tab.id === 'overview') return onSummary
    if (tab.sectionId) return activeSection === tab.sectionId
    return false
  }

  return (
    <nav className="corpus-topic-tabs" aria-label="Topic sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`corpus-topic-tab ${isActive(tab) ? 'active' : ''}`}
          onClick={() => handleClick(tab)}
          aria-current={isActive(tab) ? 'page' : undefined}
        >
          <span className="corpus-topic-tab-icon" aria-hidden>
            {tab.icon}
          </span>
          <span className="corpus-topic-tab-label">{tab.label}</span>
          {tab.count !== undefined && tab.count > 0 && (
            <span className="corpus-topic-tab-count">{tab.count}</span>
          )}
        </button>
      ))}
    </nav>
  )
}
