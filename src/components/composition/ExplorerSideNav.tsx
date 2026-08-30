import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { EntityTab } from '../EntityHeader'
import { lensNavItems } from '../dossier/categoryNav'
import {
  learnOverviewSections,
  overviewSectionCount,
  wikiOverviewSections,
  type OverviewSectionId,
} from '../../services/overviewSections'

export function ExplorerSideNav({
  kind,
  dossier,
  activeSection,
  onSection,
  onLens,
}: {
  kind: EntityKind
  dossier: EntityDossier
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  onLens: (tab: EntityTab) => void
}) {
  const learnSections = learnOverviewSections(kind, dossier)
  const wikiSections = wikiOverviewSections(kind, dossier)
  const lenses = lensNavItems(kind)

  const renderItem = (s: (typeof learnSections)[0]) => {
    const count = overviewSectionCount(dossier, s.id)
    return (
      <li key={s.id}>
        <button
          type="button"
          className={`ke-side-item ${activeSection === s.id ? 'active' : ''}`}
          onClick={() => onSection(s.id)}
        >
          <span className="ke-side-icon" aria-hidden>
            {s.icon}
          </span>
          <span className="ke-side-item-label">
            {s.navLabel}
            {count !== undefined && count > 0 && !String(s.id).startsWith('w/') && (
              <span className="ke-side-count"> ({count})</span>
            )}
          </span>
        </button>
      </li>
    )
  }

  return (
    <nav className="ke-side-nav" aria-label="On this page">
      <p className="ke-side-label">On this page</p>
      <ul className="ke-side-list">
        <li>
          <button
            type="button"
            className={`ke-side-item ${activeSection === 'summary' ? 'active' : ''}`}
            onClick={() => onSection('summary')}
          >
            <span className="ke-side-icon" aria-hidden>
              ◉
            </span>
            <span>Overview</span>
          </button>
        </li>
      </ul>

      {learnSections.length > 0 && (
        <>
          <p className="ke-side-label">Section details</p>
          <ul className="ke-side-list">{learnSections.map(renderItem)}</ul>
        </>
      )}

      {wikiSections.length > 0 && (
        <>
          <p className="ke-side-label">Wikipedia article</p>
          <ul className="ke-side-list ke-side-wiki">{wikiSections.map(renderItem)}</ul>
        </>
      )}

      <p className="ke-side-label">Explore more</p>
      <ul className="ke-side-list ke-side-lenses">
        {lenses.map((l) => (
          <li key={l.id}>
            <button type="button" className="ke-side-item lens" onClick={() => onLens(l.id)}>
              <span className="ke-side-icon" aria-hidden>
                {l.icon}
              </span>
              <span>{l.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="ke-side-promo">
        <strong>Understand anything faster</strong>
        <p>AI summary from Wikipedia, Wikidata &amp; DBpedia</p>
        <button type="button" className="ke-side-promo-btn" onClick={() => onSection('ai')}>
          Read AI summary
        </button>
      </div>
    </nav>
  )
}
