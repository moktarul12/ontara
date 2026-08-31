import { useEffect, useState } from 'react'
import type { DossierTabId, EntityDossier } from '../../types/entityDossier'
import { DOSSIER_TAB_LABELS } from '../../types/entityDossier'
import type { EntityTab } from '../EntityHeader'
import {
  AwardsPanel,
  CareerPanel,
  FamilyPanel,
  LifePanel,
  SourcesPanel,
  SummaryPanel,
  WorksPanel,
} from './DossierPanels'
import { OverviewReader } from '../reader/OverviewReader'
import { isOverviewSectionVisible, type OverviewSectionId } from '../../services/overviewSections'

const TAB_ICONS: Record<DossierTabId, string> = {
  summary: '◆',
  life: '◇',
  career: '▣',
  family: '◎',
  works: '▦',
  awards: '★',
  sources: '↗',
}

function tabCount(dossier: EntityDossier, id: DossierTabId): number | undefined {
  switch (id) {
    case 'works':
      return dossier.works.totalCount || undefined
    case 'awards':
      return dossier.awards.won.length + dossier.awards.nominated.length || undefined
    case 'family':
      return dossier.family.members.length || undefined
    case 'life':
      return dossier.life.timeline.length || undefined
    default:
      return undefined
  }
}

function DossierTabPanel({
  tab,
  dossier,
  onNavigateTab,
}: {
  tab: DossierTabId
  dossier: EntityDossier
  onNavigateTab: (tab: DossierTabId) => void
}) {
  switch (tab) {
    case 'summary':
      return <SummaryPanel dossier={dossier} onNavigateTab={onNavigateTab} />
    case 'life':
      return <LifePanel dossier={dossier} />
    case 'career':
      return <CareerPanel dossier={dossier} />
    case 'family':
      return <FamilyPanel dossier={dossier} />
    case 'works':
      return <WorksPanel dossier={dossier} />
    case 'awards':
      return <AwardsPanel dossier={dossier} />
    case 'sources':
      return <SourcesPanel dossier={dossier} />
    default:
      return null
  }
}

export function DossierView({
  dossier,
  displayLabel,
  onOpenGraph,
  onLens,
  enriching,
  overviewSection,
  onOverviewSection,
  onDossierPatch,
  contentLanguage,
  languageOptions,
  onLanguageChange,
  languageDisabled,
}: {
  dossier: EntityDossier
  displayLabel: string
  onOpenGraph: () => void
  onLens?: (tab: EntityTab) => void
  enriching?: boolean
  overviewSection: OverviewSectionId
  onOverviewSection: (id: OverviewSectionId) => void
  onDossierPatch?: (patch: (d: EntityDossier) => EntityDossier) => void
  contentLanguage?: string
  languageOptions?: { lang: string; label: string }[]
  onLanguageChange?: (lang: string) => void
  languageDisabled?: boolean
}) {
  const [tab, setTab] = useState<DossierTabId>('summary')

  useEffect(() => {
    if (!dossier.availableTabs.includes(tab)) {
      setTab(dossier.availableTabs[0] ?? 'summary')
    }
  }, [dossier, tab])

  const isDashboard = dossier.kind === 'person' || dossier.kind === 'org' || dossier.kind === 'work'

  const handleLens = (lensTab: EntityTab) => {
    if (onLens) onLens(lensTab)
    else if (lensTab === 'graph') onOpenGraph()
  }

  if (isDashboard) {
    const sectionOk =
      overviewSection === 'summary' || isOverviewSectionVisible(dossier, overviewSection)

    return (
      <div className={`dossier-view dossier-view-reader dossier-view-${dossier.kind}`}>
        {sectionOk ? (
          <OverviewReader
            kind={dossier.kind}
            dossier={dossier}
            displayLabel={displayLabel}
            activeSection={overviewSection}
            onSection={onOverviewSection}
            onOpenGraph={() => handleLens('graph')}
            onLens={handleLens}
            enriching={enriching}
            onDossierPatch={onDossierPatch}
            contentLanguage={contentLanguage}
            languageOptions={languageOptions}
            onLanguageChange={onLanguageChange}
            languageDisabled={languageDisabled}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="dossier-view">
      <div className="dossier-body">
        <nav className="dossier-sidebar" aria-label="Dossier categories">
          <p className="dossier-sidebar-label">Explore</p>
          {dossier.availableTabs.map((id) => {
            const count = tabCount(dossier, id)
            return (
              <button
                key={id}
                type="button"
                className={`dossier-nav-item ${tab === id ? 'active' : ''}`}
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
              >
                <span className="dossier-nav-icon" aria-hidden>
                  {TAB_ICONS[id]}
                </span>
                <span className="dossier-nav-text">{DOSSIER_TAB_LABELS[id]}</span>
                {count !== undefined && count > 0 && (
                  <span className="dossier-nav-badge">{count}</span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="dossier-main">
          <div className="dossier-panel-wrap" key={tab}>
            <DossierTabPanel tab={tab} dossier={dossier} onNavigateTab={setTab} />
          </div>
        </div>
      </div>
    </div>
  )
}
