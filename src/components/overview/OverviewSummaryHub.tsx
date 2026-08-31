import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'

export function OverviewSummaryHub({
  dossier,
  onSection,
}: {
  dossier: EntityDossier
  onSection: (id: OverviewSectionId) => void
  onOpenGraph?: () => void
  enriching?: boolean
}) {
  const workData = dossier.kind === 'work' ? buildWorkDashboardData(dossier) : null

  const works = dossier.summary.topWorks
  const worksTitle =
    dossier.kind === 'org' ? 'Products & brands' : dossier.kind === 'work' ? 'Related works' : 'Notable works'

  return (
    <div className="corpus-topic-body" id="ke-section-overview">
      {workData && workData.cast.length > 0 && (
        <section className="ke-panel corpus-cast-panel" id="cat-cast">
          <header className="ke-panel-head">
            <h2>Cast ({workData.cast.length})</h2>
            <button type="button" className="ke-link-btn" onClick={() => onSection('cast')}>
              View all →
            </button>
          </header>
          <div className="corpus-cast-rail">
            {workData.cast.slice(0, 10).map((member, i) => (
              <article key={`${member.name}-${i}`} className="corpus-cast-member">
                {member.imageUrl ? (
                  <img src={member.imageUrl} alt="" className="corpus-cast-photo" loading="lazy" />
                ) : (
                  <div className="corpus-cast-avatar" aria-hidden>
                    {member.name.slice(0, 1)}
                  </div>
                )}
                <strong>{member.name}</strong>
                {member.role && <span>{member.role}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      {works.length > 0 && (
        <section className="ke-panel" id="cat-works">
          <header className="ke-panel-head">
            <h2>{worksTitle}</h2>
            <button
              type="button"
              className="ke-link-btn"
              onClick={() =>
                onSection(dossier.kind === 'org' ? 'products' : dossier.kind === 'work' ? 'cast' : 'works')
              }
            >
              View all →
            </button>
          </header>
          <div className="ke-works-rail">
            {works.slice(0, 8).map((w, i) => (
              <article key={`${w.title}-${i}`} className="ke-work-card">
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="placeholder" aria-hidden>
                    {w.title.slice(0, 1)}
                  </div>
                )}
                <strong>{w.title}</strong>
                {w.year && <span>{w.year}</span>}
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
