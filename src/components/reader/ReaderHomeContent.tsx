import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { PersonDashboard } from '../dossier/PersonDashboard'
import { OrgDashboard } from '../dossier/OrgDashboard'
import { WorkDashboard } from '../dossier/WorkDashboard'
import { ReaderBrief } from './ReaderBrief'
import { ReaderChapterDeck } from './ReaderChapterDeck'

export function ReaderHomeContent({
  kind,
  dossier,
  enriching,
  onOpenGraph,
  activeWikiChapter,
  onWikiChapterChange,
}: {
  kind: EntityKind
  dossier: EntityDossier
  enriching?: boolean
  onOpenGraph: () => void
  activeWikiChapter: OverviewSectionId | null
  onWikiChapterChange: (id: OverviewSectionId) => void
}) {
  return (
    <div className="ke-overview-hub reader-home-hub">
      <ReaderBrief dossier={dossier} enriching={enriching} />

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
