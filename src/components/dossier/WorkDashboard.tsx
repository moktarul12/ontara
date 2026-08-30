import type { EntityDossier } from '../../types/entityDossier'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'
import { UnderstandSummary } from '../composition/UnderstandSummary'
import { RelatedKnowledge } from '../composition/RelatedKnowledge'
import { SourcesProvenance } from '../composition/SourcesProvenance'

const SOURCE_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  wikipedia: 'Wikipedia',
  dbpedia: 'DBpedia',
}

function DetailCard({ card }: { card: ReturnType<typeof buildWorkDashboardData>['detailCards'][0] }) {
  return (
    <article className={`film-detail-card ${card.status}`}>
      <div className="film-detail-head">
        <span>{card.label}</span>
        {card.status === 'confirmed' ? (
          <span className="film-verified-badge">✓ verified</span>
        ) : (
          <span className="film-reported-badge">reported</span>
        )}
      </div>
      <strong>{card.value}</strong>
      <div className="film-detail-sources">
        {card.sources.map((s) => (
          <span key={s} className={`film-source-chip source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
    </article>
  )
}

export function WorkDashboard({
  dossier,
  onOpenGraph,
  mainOnly,
}: {
  dossier: EntityDossier
  onOpenGraph: () => void
  mainOnly?: boolean
}) {
  const data = buildWorkDashboardData(dossier)
  const quickFacts = dossier.hero.quickFactsCard

  return (
    <div className={`film-dashboard ${mainOnly ? 'is-main-only' : ''}`}>
      <div className={`film-dashboard-grid ${mainOnly ? 'is-main-only' : ''}`}>
        <main className="film-dashboard-main">
          {!mainOnly && <UnderstandSummary dossier={dossier} imageUrl={dossier.hero.imageUrl} />}

          {data.keyStats.length > 0 && (
            <section className="film-key-stats kx-fact-highlights" id="cat-facts">
              {data.keyStats.map((s) => (
                <article key={s.label} className="film-key-stat">
                  <span className="film-key-icon" aria-hidden>
                    {s.icon}
                  </span>
                  <div>
                    <strong>{s.value}</strong>
                    <span>{s.label}</span>
                  </div>
                </article>
              ))}
            </section>
          )}

          {dossier.summary.storyBeats.length > 0 && (
            <section className="film-glance">
              <p className="film-section-label">At a glance</p>
              <div className="film-glance-grid">
                {dossier.summary.storyBeats.map((beat) => (
                  <article key={beat.label} className={`film-glance-card ${beat.verified ? 'verified' : ''}`}>
                    <span aria-hidden>{beat.icon}</span>
                    <div>
                      <em>{beat.label}</em>
                      <strong>{beat.detail}</strong>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {data.detailCards.length > 0 && (
            <section className="film-card" id="cat-details">
              <header className="film-section-head">
                <h2>Film Details</h2>
                <p>Facts matched across Wikidata, Wikipedia, and DBpedia</p>
              </header>
              <div className="film-detail-grid">
                {data.detailCards.map((c) => (
                  <DetailCard key={c.label} card={c} />
                ))}
              </div>
            </section>
          )}

          {dossier.summary.quote && (
            <blockquote className="film-trivia">
              <span className="film-trivia-label">💡 Did you know?</span>
              <p>{dossier.summary.quote}</p>
            </blockquote>
          )}

          {data.cast.length > 0 && (
            <section className="film-card film-cast-card" id="cat-cast">
              <header className="film-section-head">
                <h2>Cast ({data.cast.length})</h2>
                <p>Principal cast from linked sources</p>
              </header>
              <div className="film-cast-rail">
                {data.cast.map((member, i) => (
                  <article key={member.name} className="film-cast-member">
                    {member.imageUrl ? (
                      <img src={member.imageUrl} alt="" className="film-cast-photo" loading="lazy" />
                    ) : (
                      <div className="film-cast-avatar" aria-hidden>
                        {member.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="film-cast-rank">{i + 1}</span>
                    <strong>{member.name}</strong>
                    {member.role && <span>{member.role}</span>}
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="film-bottom-grid">
            {dossier.summary.topAwards.length > 0 && (
              <section className="film-card" id="cat-honours">
                <header className="film-section-head">
                  <h2>Awards &amp; Recognition</h2>
                </header>
                <ul className="film-award-list">
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
              <section className="film-card" id="cat-timeline">
                <header className="film-section-head">
                  <h2>Timeline</h2>
                </header>
                <ol className="film-timeline">
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
        <aside className="film-dashboard-aside">
          {quickFacts.length > 0 && (
            <section className="film-aside-card">
              <h3>Quick Facts</h3>
              <ul className="film-quick-facts">
                {quickFacts.map((f) => (
                  <li key={f.label}>
                    <span>{f.label}</span>
                    <strong>{f.value}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.genres.length > 0 && (
            <section className="film-aside-card">
              <h3>Genres</h3>
              <div className="film-genre-tags">
                {data.genres.map((g) => (
                  <span key={g} className="film-genre-tag">
                    {g}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="film-aside-card film-kg-card">
            <h3>Knowledge Graph</h3>
            <p className="film-kg-hint">Explore cast, crew, and connections</p>
            <button type="button" className="film-kg-btn" onClick={onOpenGraph}>
              Open Knowledge Graph →
            </button>
          </section>
        </aside>
        )}
      </div>
    </div>
  )
}
