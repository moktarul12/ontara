import type { EntityDossier } from '../../types/entityDossier'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { RelatedKnowledge } from '../composition/RelatedKnowledge'
import { SourcesProvenance } from '../composition/SourcesProvenance'

function RevenueChart({ points }: { points: ReturnType<typeof buildOrgDashboardData>['financialPoints'] }) {
  if (!points.length) return null
  return (
    <div className="org-revenue-chart">
      <div className="org-chart-bars">
        {points.map((p) => (
          <div key={p.label} className="org-chart-bar-wrap">
            <div className="org-chart-bar" style={{ height: `${p.pct}%` }} title={p.display} />
            <span className="org-chart-label">{p.label}</span>
          </div>
        ))}
      </div>
      <div className="org-chart-legend">
        {points.map((p) => (
          <span key={p.label}>{p.display}</span>
        ))}
      </div>
    </div>
  )
}

export function OrgDashboard({
  dossier,
  onOpenGraph,
  mainOnly,
}: {
  dossier: EntityDossier
  onOpenGraph: () => void
  mainOnly?: boolean
}) {
  const data = buildOrgDashboardData(dossier)
  const quickFacts = dossier.hero.quickFactsCard

  return (
    <div className={`org-dashboard ${mainOnly ? 'is-main-only' : ''}`}>
      <div className={`org-dashboard-grid ${mainOnly ? 'is-main-only' : ''}`}>
        <main className="org-dashboard-main">
          {!mainOnly && data.highlights.length > 0 && (
            <section className="org-highlights kx-fact-highlights" id="cat-facts">
              {data.highlights.map((h) => (
                <article key={h.label} className="org-highlight-card">
                  <span className="org-highlight-label">{h.label}</span>
                  <strong>{h.value}</strong>
                  {h.hint && <span className="org-highlight-hint">{h.hint}</span>}
                </article>
              ))}
            </section>
          )}

          {!mainOnly &&
            (data.financialPoints.length > 0 ||
              dossier.summary.verifiedFacts.some((f) => /revenue|employees|net/i.test(f.label))) && (
            <section className="org-card org-financial-card" id="cat-financials">
              <header className="org-section-head">
                <h2>Financial Overview</h2>
                <p>Key figures from linked open data</p>
              </header>
              <div className="org-fin-metrics">
                {data.heroMetrics
                  .filter((m) => /revenue|income|cap|employees/i.test(m.label))
                  .slice(0, 4)
                  .map((m) => (
                    <article key={m.label} className="org-fin-metric">
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                    </article>
                  ))}
              </div>
              {data.financialPoints.length > 1 && (
                <div className="org-fin-chart-wrap">
                  <h3>Revenue trend</h3>
                  <RevenueChart points={data.financialPoints} />
                </div>
              )}
            </section>
          )}

          {data.timeline.length > 0 && !mainOnly && (
            <section className="org-card org-history-card" id="cat-history">
              <header className="org-section-head">
                <h2>Company History</h2>
                <p>Timeline of founding, leadership, and major milestones</p>
              </header>
              <ol className="org-history-timeline">
                {data.timeline.map((m, i) => (
                  <li key={`${m.label}-${m.year}-${i}`}>
                    <div className="org-history-dot" aria-hidden />
                    <div className="org-history-body">
                      {m.year && <time>{m.year}</time>}
                      <strong>{m.label}</strong>
                      {m.detail && m.detail !== m.label && <span>{m.detail}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {data.keyPeople.length > 0 && !mainOnly && (
            <section className="org-card" id="cat-leadership">
              <header className="org-section-head">
                <h2>Leadership</h2>
                <p>Key executives and governance</p>
              </header>
              <ul className="org-people-list org-people-main">
                {data.keyPeople.map((p) => (
                  <li key={p.name}>
                    <div className="org-person-avatar" aria-hidden>
                      {p.name.slice(0, 1)}
                    </div>
                    <div>
                      <strong>{p.name}</strong>
                      <span>{p.role}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="org-bottom-grid">
            {data.products.length > 0 && !mainOnly && (
              <section className="org-card org-products-card" id="cat-products">
                <header className="org-section-head">
                  <h2>Business Segments</h2>
                  <p>Products &amp; brands</p>
                </header>
                <div className="org-product-list">
                  {data.products.map((p) => (
                    <article key={p.name} className="org-product-item">
                      <span className="org-product-dot" aria-hidden />
                      <strong>{p.name}</strong>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {dossier.summary.topAwards.length > 0 && !mainOnly && (
              <section className="org-card org-awards-card" id="cat-honours">
                <header className="org-section-head">
                  <h2>Honours</h2>
                  <p>Notable awards</p>
                </header>
                <ul className="org-award-list">
                  {dossier.summary.topAwards.map((a, i) => (
                    <li key={`${a.name}-${i}`}>
                      <span aria-hidden>★</span>
                      <div>
                        <strong>{a.name}</strong>
                        {a.year && <em>{a.year}</em>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <RelatedKnowledge dossier={dossier} onOpenGraph={onOpenGraph} />
          {!mainOnly && <SourcesProvenance dossier={dossier} />}
        </main>

        {!mainOnly && (
        <aside className="org-dashboard-aside">
          {quickFacts.length > 0 && (
            <section className="org-aside-card">
              <h3>Quick Facts</h3>
              <ul className="org-quick-facts">
                {quickFacts.map((f) => (
                  <li key={f.label}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="org-aside-card org-kg-card">
            <h3>Knowledge Graph</h3>
            <p className="org-kg-hint">Explore connections in the knowledge graph</p>
            <button type="button" className="org-kg-btn" onClick={onOpenGraph}>
              Open Knowledge Graph →
            </button>
          </section>
        </aside>
        )}
      </div>
    </div>
  )
}
