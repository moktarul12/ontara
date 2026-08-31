import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { overviewSectionDef } from '../../services/overviewSections'
import { languageDisplayName } from '../../services/entityLanguages'

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
  contentLanguage,
  languageOptions,
  onLanguageChange,
  languageDisabled,
  enriching,
}: {
  displayLabel: string
  kind: EntityKind
  section?: OverviewSectionId
  dossier?: EntityDossier
  onBack?: () => void
  contentLanguage?: string
  languageOptions?: { lang: string; label: string }[]
  onLanguageChange?: (lang: string) => void
  languageDisabled?: boolean
  enriching?: boolean
}) {
  const sectionDef = section ? overviewSectionDef(kind, section, dossier) : undefined
  const showLanguage = Boolean(onLanguageChange && contentLanguage)

  return (
    <div className="ke-breadcrumb-bar">
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

      {showLanguage && (
        <div className="ke-breadcrumb-actions">
          <select
            className="or-lang corpus-lang ke-breadcrumb-lang"
            value={contentLanguage}
            disabled={languageDisabled}
            onChange={(e) => onLanguageChange?.(e.target.value)}
            aria-label="Content language"
          >
            {(languageOptions?.length
              ? languageOptions
              : [{ lang: contentLanguage!, label: displayLabel }]
            ).map((v) => (
              <option key={v.lang} value={v.lang}>
                {languageDisplayName(v.lang)}
              </option>
            ))}
          </select>
          {enriching && <span className="corpus-enriching-pill">Updating…</span>}
        </div>
      )}
    </div>
  )
}
