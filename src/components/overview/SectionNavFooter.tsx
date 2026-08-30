import type { OverviewSectionDef } from '../../services/overviewSections'
import type { OverviewSectionId } from '../../services/overviewSections'

export function SectionNavFooter({
  prev,
  next,
  onSection,
}: {
  prev?: OverviewSectionDef
  next?: OverviewSectionDef
  onSection: (id: OverviewSectionId) => void
}) {
  if (!prev && !next) return null

  return (
    <footer className="kx-section-nav-foot">
      {prev ? (
        <button type="button" className="kx-section-nav-btn prev" onClick={() => onSection(prev.id)}>
          <span className="kx-section-nav-label">Previous</span>
          <strong>← {prev.navLabel}</strong>
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button type="button" className="kx-section-nav-btn next" onClick={() => onSection(next.id)}>
          <span className="kx-section-nav-label">Next</span>
          <strong>{next.navLabel} →</strong>
        </button>
      ) : (
        <span />
      )}
    </footer>
  )
}
