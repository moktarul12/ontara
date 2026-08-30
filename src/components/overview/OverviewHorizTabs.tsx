import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import {
  visibleOverviewSections,
  type OverviewSectionId,
} from '../../services/overviewSections'

export function OverviewHorizTabs({
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
  const all = visibleOverviewSections(kind, dossier)
  const tabs = [
    ...all.filter((s) => s.id === 'summary'),
    ...all.filter((s) => s.group === 'learn'),
  ]

  return (
    <nav className="mock-horiz-tabs" aria-label="Page sections">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`mock-horiz-tab ${activeSection === t.id ? 'active' : ''}`}
          onClick={() => onSection(t.id)}
        >
          {t.navLabel}
        </button>
      ))}
    </nav>
  )
}
