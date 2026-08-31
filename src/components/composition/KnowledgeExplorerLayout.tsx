import type { ReactNode } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { EntityTab } from '../EntityHeader'
import type { OverviewSectionId } from '../../services/overviewSections'
import { ExplorerIconRail } from './ExplorerIconRail'
import { CorpusTopicTabs } from './CorpusTopicTabs'
import { OverviewRightRail } from '../overview/OverviewRightRail'
import { OverviewBreadcrumb } from '../overview/OverviewBreadcrumb'

export function KnowledgeExplorerLayout({
  kind,
  dossier,
  displayLabel,
  hero,
  activeSection,
  onSection,
  onOpenGraph,
  children,
  contentLanguage,
  languageOptions,
  onLanguageChange,
  languageDisabled,
  enriching,
}: {
  kind: EntityKind
  dossier: EntityDossier
  displayLabel: string
  hero: ReactNode
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  children: ReactNode
  onLens?: (tab: EntityTab) => void
  onOpenGraph: () => void
  contentLanguage?: string
  languageOptions?: { lang: string; label: string }[]
  onLanguageChange?: (lang: string) => void
  languageDisabled?: boolean
  enriching?: boolean
}) {
  const showHero = activeSection === 'summary'

  return (
    <div className="ke-wiki-layout ke-v3-layout">
      <ExplorerIconRail
        kind={kind}
        dossier={dossier}
        isHome={showHero}
        activeSection={activeSection}
        onSection={onSection}
      />

      <div className="ke-wiki-main">
        <OverviewBreadcrumb
          displayLabel={displayLabel}
          kind={kind}
          dossier={dossier}
          section={activeSection === 'summary' ? undefined : activeSection}
          onBack={activeSection !== 'summary' ? () => onSection('summary') : undefined}
          contentLanguage={contentLanguage}
          languageOptions={languageOptions}
          onLanguageChange={onLanguageChange}
          languageDisabled={languageDisabled}
          enriching={enriching}
        />

        {showHero && (
          <>
            {hero}
            <CorpusTopicTabs
              kind={kind}
              dossier={dossier}
              activeSection={activeSection}
              onSection={onSection}
            />
          </>
        )}

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
