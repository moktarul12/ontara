import type { ReactNode } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { EntityTab } from '../EntityHeader'
import type { OverviewSectionId } from '../../services/overviewSections'
import { ExplorerSideNav } from './ExplorerSideNav'
import { OverviewRightRail } from '../overview/OverviewRightRail'
import { OverviewBreadcrumb } from '../overview/OverviewBreadcrumb'

export function KnowledgeExplorerLayout({
  kind,
  dossier,
  displayLabel,
  hero,
  activeSection,
  onSection,
  children,
  onLens,
  onOpenGraph,
}: {
  kind: EntityKind
  dossier: EntityDossier
  displayLabel: string
  hero: ReactNode
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  children: ReactNode
  onLens: (tab: EntityTab) => void
  onOpenGraph: () => void
}) {
  const showHero = activeSection === 'summary'

  return (
    <div className="ke-wiki-layout">
      <ExplorerSideNav
        kind={kind}
        dossier={dossier}
        activeSection={activeSection}
        onSection={onSection}
        onLens={onLens}
      />

      <div className="ke-wiki-main">
        <OverviewBreadcrumb
          displayLabel={displayLabel}
          kind={kind}
          dossier={dossier}
          section={activeSection === 'summary' ? undefined : activeSection}
          onBack={activeSection !== 'summary' ? () => onSection('summary') : undefined}
        />

        {showHero && hero}

        <div className="ke-wiki-body">
          <div className={`ke-wiki-content ${activeSection === 'summary' ? 'is-overview' : 'is-detail'}`}>
            {children}
          </div>
          <OverviewRightRail
            dossier={dossier}
            onSection={onSection}
            onOpenGraph={onOpenGraph}
          />
        </div>
      </div>
    </div>
  )
}
