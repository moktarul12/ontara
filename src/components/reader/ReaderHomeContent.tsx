import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { OverviewSummaryHub } from '../overview/OverviewSummaryHub'
import { PersonDashboard } from '../dossier/PersonDashboard'
import { OrgDashboard } from '../dossier/OrgDashboard'
import { WorkDashboard } from '../dossier/WorkDashboard'
import { CorpusReadingPane } from './CorpusReadingPane'
import { ReaderChapterDeck } from './ReaderChapterDeck'

export function ReaderHomeContent({
  kind,
  dossier,
  enriching,
  onOpenGraph,
  onSection,
  activeWikiChapter,
  onWikiChapterChange,
  onDossierPatch,
}: {
  kind: EntityKind
  dossier: EntityDossier
  enriching?: boolean
  onOpenGraph: () => void
  onSection: (id: OverviewSectionId) => void
  activeWikiChapter: OverviewSectionId | null
  onWikiChapterChange: (id: OverviewSectionId) => void
  onDossierPatch?: (patch: (d: EntityDossier) => EntityDossier) => void
}) {
  return (
    <div className="ke-overview-hub reader-home-hub corpus-topic-hub">
      <CorpusReadingPane
        dossier={dossier}
        activeId={activeWikiChapter}
        onActiveChange={onWikiChapterChange}
        onDossierPatch={onDossierPatch}
      />

      <OverviewSummaryHub
        dossier={dossier}
        onSection={onSection}
        onOpenGraph={onOpenGraph}
        enriching={enriching}
      />

      {kind === 'person' && (
        <PersonDashboard dossier={dossier} onOpenGraph={onOpenGraph} mainOnly />
      )}
      {kind === 'org' && <OrgDashboard dossier={dossier} onOpenGraph={onOpenGraph} mainOnly />}
      {kind === 'work' && <WorkDashboard dossier={dossier} onOpenGraph={onOpenGraph} mainOnly />}

      <ReaderChapterDeck
        dossier={dossier}
        activeId={activeWikiChapter}
        onActiveChange={onWikiChapterChange}
      />
    </div>
  )
}
