import { useCallback, useState } from 'react'
import type { EntityDossier } from '../../types/entityDossier'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityTab } from '../EntityHeader'
import type { OverviewSectionId } from '../../services/overviewSections'
import { overviewSectionDef } from '../../services/overviewSections'
import { isWikiSectionId } from '../../services/wikiSectionNav'
import { KnowledgeExplorerLayout } from '../composition/KnowledgeExplorerLayout'
import { OverviewSectionView } from '../overview/OverviewSectionView'
import { EntityReaderHero } from './EntityReaderHero'
import { ReaderHomeContent } from './ReaderHomeContent'

export function OverviewReader({
  kind,
  dossier,
  displayLabel,
  activeSection,
  onSection,
  onOpenGraph,
  onLens,
  enriching,
}: {
  kind: EntityKind
  dossier: EntityDossier
  displayLabel: string
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  onOpenGraph: () => void
  onLens?: (tab: EntityTab) => void
  enriching?: boolean
}) {
  const isHome = activeSection === 'summary'
  const sectionDef = !isHome ? overviewSectionDef(kind, activeSection, dossier) : undefined
  const [activeWikiChapter, setActiveWikiChapter] = useState<OverviewSectionId | null>(null)

  const openWikiChapter = useCallback((id: OverviewSectionId) => {
    setActiveWikiChapter(id)
    requestAnimationFrame(() => {
      document.getElementById('or-chapters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  const handleSection = useCallback(
    (id: OverviewSectionId) => {
      if (isHome && isWikiSectionId(id)) {
        openWikiChapter(id)
        return
      }
      onSection(id)
    },
    [isHome, onSection, openWikiChapter],
  )

  const handleLens = useCallback(
    (tab: EntityTab) => {
      if (onLens) onLens(tab)
      else if (tab === 'graph') onOpenGraph()
    },
    [onLens, onOpenGraph],
  )

  return (
    <KnowledgeExplorerLayout
      kind={kind}
      dossier={dossier}
      displayLabel={displayLabel}
      hero={
        isHome ? (
          <EntityReaderHero
            kind={kind}
            dossier={dossier}
            displayLabel={displayLabel}
            enriching={enriching}
            onOpenGraph={onOpenGraph}
          />
        ) : null
      }
      activeSection={activeSection}
      onSection={handleSection}
      onLens={handleLens}
      onOpenGraph={onOpenGraph}
    >
      {isHome ? (
        <ReaderHomeContent
          kind={kind}
          dossier={dossier}
          enriching={enriching}
          onOpenGraph={onOpenGraph}
          activeWikiChapter={activeWikiChapter}
          onWikiChapterChange={setActiveWikiChapter}
        />
      ) : (
        <article className="ke-detail-article">
          {sectionDef && (
            <header className="ke-detail-head">
              <p className="or-kicker">{sectionDef.navLabel}</p>
              <h1 className="ke-detail-title">{sectionDef.title}</h1>
              <p className="or-section-dek">{sectionDef.description}</p>
            </header>
          )}
          <OverviewSectionView
            kind={kind}
            dossier={dossier}
            sectionId={activeSection}
            onSection={onSection}
            onOpenGraph={onOpenGraph}
            compact={!isWikiSectionId(activeSection)}
          />
        </article>
      )}
    </KnowledgeExplorerLayout>
  )
}
