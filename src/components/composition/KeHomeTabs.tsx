import { useMemo } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'

type HomeTab = { id: string; label: string }

function tabsFor(kind: EntityKind, dossier: EntityDossier): HomeTab[] {
  const tabs: HomeTab[] = [{ id: 'ke-section-overview', label: 'Overview' }]

  if (kind === 'person') {
    const data = buildPersonDashboardData(dossier)
    if (data.highlights.length || dossier.summary.storyBeats.length) {
      tabs.push({ id: 'cat-facts', label: 'At a glance' })
    }
    if (data.timeline.length) tabs.push({ id: 'ke-section-timeline', label: 'Timeline' })
    if (dossier.summary.topWorks.length) tabs.push({ id: 'cat-works', label: 'Filmography' })
    if (dossier.summary.topAwards.length) tabs.push({ id: 'cat-honours', label: 'Awards' })
  } else if (kind === 'work') {
    const data = buildWorkDashboardData(dossier)
    if (data.keyStats.length || dossier.summary.storyBeats.length) {
      tabs.push({ id: 'cat-facts', label: 'At a glance' })
    }
    if (data.cast.length) tabs.push({ id: 'cat-cast', label: 'Cast' })
    if (dossier.summary.topAwards.length) tabs.push({ id: 'cat-honours', label: 'Awards' })
    if (data.timeline.length) tabs.push({ id: 'ke-section-timeline', label: 'Timeline' })
  } else if (kind === 'org') {
    const data = buildOrgDashboardData(dossier)
    if (data.highlights.length) tabs.push({ id: 'cat-facts', label: 'Business' })
    if (data.products.length) tabs.push({ id: 'cat-products', label: 'Products' })
    if (data.timeline.length) tabs.push({ id: 'ke-section-timeline', label: 'Timeline' })
    if (data.keyPeople.length) tabs.push({ id: 'cat-leadership', label: 'Leadership' })
  }

  if ((dossier.wikipedia?.sections.length ?? 0) > 0) {
    tabs.push({ id: 'or-chapters', label: 'Article' })
  }

  return tabs
}

export function KeHomeTabs({ kind, dossier }: { kind: EntityKind; dossier: EntityDossier }) {
  const tabs = useMemo(() => tabsFor(kind, dossier), [kind, dossier])

  if (tabs.length <= 1) return null

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="ke-home-tabs" aria-label="In-page sections">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className="ke-home-tab" onClick={() => scrollTo(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
