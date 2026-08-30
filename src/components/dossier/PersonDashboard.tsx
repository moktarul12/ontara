import type { EntityDossier } from '../../types/entityDossier'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { UnderstandSummary } from '../composition/UnderstandSummary'
import { RelatedKnowledge } from '../composition/RelatedKnowledge'
import { SourcesProvenance } from '../composition/SourcesProvenance'

const SOURCE_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  wikipedia: 'Wikipedia',
  dbpedia: 'DBpedia',
}

function DetailCard({ card }: { card: ReturnType<typeof buildPersonDashboardData>['detailCards'][0] }) {
  return (
    <article className={`person-detail-card ${card.status}`}>
      <div className="person-detail-head">
        <span>{card.label}</span>
        {card.status === 'confirmed' ? (
          <span className="person-verified-badge">✓ verified</span>
        ) : (
          <span className="person-reported-badge">reported</span>
        )}
      </div>
      <strong>{card.value}</strong>
      <div className="person-detail-sources">
        {card.sources.map((s) => (
          <span key={s} className={`person-source-chip source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
    </article>
  )
}

export function PersonDashboard({
  dossier,
  onOpenGraph,
  mainOnly,
}: {
  dossier: EntityDossier
  onOpenGraph: () => void
  mainOnly?: boolean
}) {
  const data = buildPersonDashboardData(dossier)
  const quickFacts = dossier.hero.quickFactsCard

  return (
    <div className={`person-dashboard ${mainOnly ? 'is-main-only' : ''}`}>
      <div className={`person-dashboard-grid ${mainOnly ? 'is-main-only' : ''}`}>
        <main className="person-dashboard-main">
          {!mainOnly && <UnderstandSummary dossier={dossier} imageUrl={dossier.hero.imageUrl} />}

          {data.highlights.length > 0 ? (
            <section className="person-glance kx-fact-highlights" id="cat-facts">
              <p className="person-section-label">At a glance</p>
              <div className="person-glance-grid">
                {data.highlights.map((h) => (
                  <article key={h.label} className="person-glance-card verified">
                    <span aria-hidden>✦</span>
                    <div>
                      <em>{h.label}</em>
                      <strong>{h.value}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : dossier.summary.storyBeats.length > 0 ? (
            <section className="person-glance">
              <p className="person-section-label">At a glance</p>
              <div className="person-glance-grid">
                {dossier.summary.storyBeats.map((beat) => (
                  <article key={beat.label} className={`person-glance-card ${beat.verified ? 'verified' : ''}`}>
                    <span aria-hidden>{beat.icon}</span>
                    <div>
                      <em>{beat.label}</em>
                      <strong>{beat.detail}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {data.detailCards.length > 0 && (
            <section className="person-card" id="cat-details">
              <header className="person-section-head">
                <h2>Personal Details</h2>
                <p>Facts matched across Wikidata, Wikipedia, and DBpedia</p>
              </header>
              <div className="person-detail-grid">
                {data.detailCards.map((c) => (
                  <DetailCard key={c.label} card={c} />
                ))}
              </div>
            </section>
          )}

          {dossier.summary.careerEras.length > 0 && (
            <section className="person-card" id="cat-career">
              <header className="person-section-head">
                <h2>Career Phases</h2>
              </header>
              <div className="person-phase-rail">
                {dossier.summary.careerEras.map((era, i) => (
                  <article key={`${era.title}-${i}`} className="person-phase-chip">
                    {era.era && <time>{era.era}</time>}
                    <span>{era.title}</span>
                  </article>
                ))}
              </div>
            </section>
          )}

          {dossier.summary.topWorks.length > 0 && (
            <section className="person-card" id="cat-works">
              <header className="person-section-head">
                <h2>Popular Films</h2>
                <p>Notable works from linked sources</p>
              </header>
              <div className="person-film-rail">
                {dossier.summary.topWorks.map((w, i) => (
                  <article key={`${w.title}-${i}`} className="person-film-card">
                    {w.imageUrl ? (
                      <img src={w.imageUrl} alt="" className="person-film-poster" loading="lazy" />
                    ) : (
                      <div className="person-film-poster placeholder" aria-hidden>
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

          <div className="person-bottom-grid">
            {dossier.summary.topAwards.length > 0 && (
              <section className="person-card" id="cat-honours">
                <header className="person-section-head">
                  <h2>Top Honours</h2>
                </header>
                <ul className="person-award-list">
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

            {data.timeline.length > 0 && (
              <section className="person-card" id="cat-timeline">
                <header className="person-section-head person-timeline-head">
                  <div>
                    <h2>Timeline Highlights</h2>
                    <p>Key dates across life and career</p>
                  </div>
                  <button type="button" className="person-timeline-link" onClick={onOpenGraph}>
                    View full timeline →
                  </button>
                </header>
                <ol className="person-timeline">
                  {data.timeline.map((m, i) => (
                    <li key={`${m.label}-${i}`}>
                      {m.year && <time>{m.year}</time>}
                      <div>
                        <strong>{m.label}</strong>
                        {m.detail && <span>{m.detail}</span>}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <RelatedKnowledge dossier={dossier} onOpenGraph={onOpenGraph} />
          {!mainOnly && <SourcesProvenance dossier={dossier} />}
        </main>

        {!mainOnly && (
        <aside className="person-dashboard-aside">
          {quickFacts.length > 0 && (
            <section className="person-aside-card">
              <h3>Quick Facts</h3>
              <ul className="person-quick-facts">
                {quickFacts.map((f) => (
                  <li key={f.label}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {dossier.family.members.length > 0 && (
            <section className="person-aside-card" id="cat-family">
              <h3>Family</h3>
              <ul className="person-family-list">
                {dossier.family.members.slice(0, 6).map((m, i) => (
                  <li key={`${m.relation}-${m.name}-${i}`}>
                    {m.imageUrl ? (
                      <img src={m.imageUrl} alt="" className="person-family-photo" loading="lazy" />
                    ) : (
                      <div className="person-family-avatar" aria-hidden>
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

          <section className="person-aside-card person-kg-card">
            <h3>Knowledge Graph</h3>
            <p className="person-kg-hint">Explore films, family, and connections</p>
            <button type="button" className="person-kg-btn" onClick={onOpenGraph}>
              Open Knowledge Graph →
            </button>
          </section>
        </aside>
        )}
      </div>
    </div>
  )
}
