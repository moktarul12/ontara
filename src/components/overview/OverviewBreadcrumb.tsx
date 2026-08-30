import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { overviewSectionDef } from '../../services/overviewSections'

const KIND_LABELS: Record<EntityKind, string> = {
  person: 'People',
  org: 'Companies',
  work: 'Films & Media',
  place: 'Places',
  other: 'Topics',
}

export function OverviewBreadcrumb({
  displayLabel,
  kind,
  section,
  dossier,
  onBack,
}: {
  displayLabel: string
  kind: EntityKind
  section?: OverviewSectionId
  dossier?: EntityDossier
  onBack?: () => void
}) {
  const sectionDef = section ? overviewSectionDef(kind, section, dossier) : undefined

  return (
    <nav className="ke-breadcrumb" aria-label="Breadcrumb">
      <span className="ke-crumb-muted">Home</span>
      <span className="ke-crumb-sep">›</span>
      <span className="ke-crumb-muted">{KIND_LABELS[kind]}</span>
      <span className="ke-crumb-sep">›</span>
      {onBack ? (
        <button type="button" className="ke-crumb-link" onClick={onBack}>
          {displayLabel}
        </button>
      ) : (
        <span className="ke-crumb-current">{displayLabel}</span>
      )}
      {sectionDef && (
        <>
          <span className="ke-crumb-sep">›</span>
          <span className="ke-crumb-current">{sectionDef.navLabel}</span>
        </>
      )}
    </nav>
  )
}
