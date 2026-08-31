import type { EntityDossier } from '../../types/entityDossier'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'

export function OverviewRightRail({
  dossier,
  onOpenGraph,
}: {
  dossier: EntityDossier
  onOpenGraph: () => void
}) {
  const quickFacts = dossier.hero.quickFactsCard.length
    ? dossier.hero.quickFactsCard
    : dossier.wikipedia?.infobox.slice(0, 8).map((r) => ({
        label: r.label,
        value: r.values.map((v) => v.text).join(', '),
      })) ?? []

  const factsTitle =
    dossier.kind === 'org' ? 'Company facts' : dossier.kind === 'work' ? 'Movie facts' : 'Quick facts'

  const orgPeople = dossier.kind === 'org' ? buildOrgDashboardData(dossier).keyPeople : []
  const castPreview = dossier.kind === 'work' ? buildWorkDashboardData(dossier).cast.slice(0, 6) : []
  const relationships = dossier.family.members.slice(0, 6)

  return (
    <aside className="ke-right-rail" aria-label="Quick facts">
      {quickFacts.length > 0 && (
        <section className="ke-rail-card">
          <h3>{factsTitle}</h3>
          <ul className="ke-facts-list">
            {quickFacts.map((f) => (
              <li key={f.label}>
                <span>{f.label}</span>
                <strong>{f.value}</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relationships.length > 0 && (
        <section className="ke-rail-card ke-rail-people" id="ke-rail-relationships">
          <h3>Relationships</h3>
          <ul className="ke-people-list">
            {relationships.map((m, i) => (
              <li key={`${m.relation}-${m.name}-${i}`}>
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="ke-people-photo" loading="lazy" />
                ) : (
                  <div className="ke-people-avatar" aria-hidden>
                    {m.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <span>{m.relation}</span>
                  <strong>{m.name}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orgPeople.length > 0 && (
        <section className="ke-rail-card ke-rail-people">
          <h3>Key leadership</h3>
          <ul className="ke-people-list">
            {orgPeople.map((p) => (
              <li key={p.name}>
                <div className="ke-people-avatar" aria-hidden>
                  {p.name.slice(0, 1)}
                </div>
                <div>
                  <span>{p.role}</span>
                  <strong>{p.name}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {castPreview.length > 0 && (
        <section className="ke-rail-card ke-rail-people">
          <h3>Cast</h3>
          <ul className="ke-people-list">
            {castPreview.map((m) => (
              <li key={m.name}>
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="ke-people-photo" loading="lazy" />
                ) : (
                  <div className="ke-people-avatar" aria-hidden>
                    {m.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  {m.role && <span>{m.role}</span>}
                  <strong>{m.name}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="ke-rail-card ke-kg-card">
        <h3>Knowledge graph</h3>
        <p className="ke-rail-muted">Explore connections between people, works, and organizations.</p>
        <button type="button" className="ke-rail-btn primary" onClick={onOpenGraph}>
          Explore full graph →
        </button>
      </section>
    </aside>
  )
}
