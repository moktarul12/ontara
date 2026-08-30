import { useState, type CSSProperties } from 'react'
import type { DossierTabId, EntityDossier, QuickFact } from '../../types/entityDossier'
import { formatFactDisplay } from '../../utils/factFormatter'

const FACT_ICONS: Record<string, string> = {
  Born: '📍',
  'Full Name': '👤',
  Birthplace: '📍',
  Nationality: '🌐',
  Citizenship: '🌐',
  Religion: '☪',
  Languages: '🗣',
  Occupation: '💼',
  Spouse: '💍',
  Children: '👨‍👩‍👧',
  Education: '🎓',
  'Parent(s)': '👪',
  Awards: '🏆',
  Website: '🔗',
  Died: '✦',
  Founded: '📅',
  Director: '🎬',
  'Written by': '✍️',
  'Produced by': '🎞',
  'Music by': '🎵',
  Release: '📅',
  Genre: '🎭',
  Country: '🌐',
  Language: '🗣',
  Studio: '🏢',
  'Distributed by': '📡',
  Type: '🏷',
  Industry: '🏭',
  Headquarters: '🏛',
  CEO: '👤',
  Employees: '👥',
}

function iconFor(label: string): string {
  return FACT_ICONS[label] ?? '•'
}

function HighlightTiles({ facts }: { facts: QuickFact[] }) {
  if (!facts.length) return null
  return (
    <div className="dossier-highlight-tiles">
      {facts.map((f) => (
        <article key={f.label} className="dossier-highlight-tile">
          <span className="dossier-tile-icon" aria-hidden>
            {iconFor(f.label)}
          </span>
          <div className="dossier-tile-body">
            <h4>{f.label}</h4>
            <p>{f.value}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

function ExpandableProse({ text, limit = 480 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false)
  if (text.length <= limit) return <p className="dossier-prose">{text}</p>
  return (
    <div className="dossier-expandable">
      <p className="dossier-prose">{open ? text : `${text.slice(0, limit).trim()}…`}</p>
      <button type="button" className="kg-link-btn" onClick={() => setOpen(!open)}>
        {open ? 'Show less' : 'Read more'}
      </button>
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  wikipedia: 'Wikipedia',
  dbpedia: 'DBpedia',
}

function SourceTrustBar({ trust }: { trust: EntityDossier['summary']['sourceTrust'] }) {
  if (!trust.sources.length) return null
  return (
    <div className="kg-trust-bar" role="status">
      <span className="kg-trust-title">Cross-checked</span>
      <div className="kg-trust-sources">
        {trust.sources.map((s) => (
          <span key={s} className={`kg-trust-chip source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
      <span className="kg-trust-stats">
        {trust.confirmedCount > 0 && (
          <em className="kg-trust-confirmed">{trust.confirmedCount} confirmed</em>
        )}
        {trust.reportedCount > 0 && (
          <span className="kg-trust-reported">{trust.reportedCount} from single source</span>
        )}
      </span>
    </div>
  )
}

function VerifiedFactRow({ fact }: { fact: EntityDossier['summary']['verifiedFacts'][0] }) {
  return (
    <article className={`kg-verified-fact ${fact.status}`}>
      <div className="kg-verified-fact-head">
        <span className="kg-detail-label">{fact.label}</span>
        {fact.status === 'confirmed' ? (
          <span className="kg-verified-badge" title="Confirmed by multiple sources">
            ✓ verified
          </span>
        ) : (
          <span className="kg-reported-badge" title="From one linked source">
            reported
          </span>
        )}
      </div>
      {fact.values && fact.values.length > 1 ? (
        <div className="dossier-chip-row">
          {fact.values.slice(0, 5).map((v) => (
            <span key={v} className="dossier-chip">
              {v}
            </span>
          ))}
        </div>
      ) : (
        <strong className="kg-verified-value">{fact.value}</strong>
      )}
      <div className="kg-fact-sources">
        {fact.sources.map((s) => (
          <span key={s} className={`kg-fact-source source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
    </article>
  )
}

export function SummaryPanel({
  dossier,
  onNavigateTab,
}: {
  dossier: EntityDossier
  onNavigateTab?: (tab: DossierTabId) => void
}) {
  const { summary } = dossier
  const isWork = dossier.kind === 'work'
  const isOrg = dossier.kind === 'org'
  const detailsTitle = isWork ? 'Film Details' : isOrg ? 'Company Details' : 'Personal Details'
  const featuredTitle = isWork ? 'Cast' : 'Notable Works'
  const awardsTitle = isWork ? 'Awards' : 'Top Honours'

  return (
    <div className="dossier-panel dossier-panel-rich kg-summary-panel">
      <div className="kg-dashboard">
        <SourceTrustBar trust={summary.sourceTrust} />

        {(summary.readingHook || summary.storyParagraph) && (
          <section className="kg-reading-hero">
            <span className="kg-ai-label">AI summary</span>
            {summary.readingHook && <h2 className="kg-reading-hook">{summary.readingHook}</h2>}
            {summary.storyParagraph && summary.storyParagraph !== summary.readingHook && (
              <p className="kg-reading-body">{summary.storyParagraph}</p>
            )}
          </section>
        )}

        {summary.storyBeats.length > 0 && (
          <section className="kg-beats-row" aria-label="At a glance">
            <p className="kg-beats-intro">At a glance</p>
            <div className="kg-beats-grid">
              {summary.storyBeats.map((beat) => (
                <article
                  key={beat.label}
                  className={`kg-beat-card ${beat.verified ? 'verified' : ''}`}
                >
                  <span className="kg-beat-icon" aria-hidden>
                    {beat.icon}
                  </span>
                  <div>
                    <span className="kg-beat-label">
                      {beat.label}
                      {beat.verified && <span className="kg-beat-check" aria-label="Verified"> ✓</span>}
                    </span>
                    <strong>{beat.detail}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="kg-dashboard-grid">
          <div className="kg-dashboard-main">
            {summary.verifiedFacts.length > 0 && (
              <section className="kg-dash-card kg-verified-card">
                <h3>{detailsTitle}</h3>
                <p className="kg-card-hint">Facts matched across Wikidata, Wikipedia, and DBpedia where possible.</p>
                <div className="kg-verified-grid">
                  {summary.verifiedFacts.slice(0, 10).map((f) => (
                    <VerifiedFactRow key={f.label} fact={f} />
                  ))}
                </div>
              </section>
            )}

            {!summary.verifiedFacts.length && summary.personalDetails.length > 0 && (
              <section className="kg-dash-card">
                <h3>{detailsTitle}</h3>
                <div className="kg-detail-tiles">
                  {summary.personalDetails.map((d) => (
                    <article key={d.label} className="kg-detail-tile">
                      <span className="kg-detail-icon" aria-hidden>
                        {iconFor(d.label)}
                      </span>
                      <div>
                        <span className="kg-detail-label">{d.label}</span>
                        {d.values && d.values.length > 1 ? (
                          <div className="dossier-chip-row">
                            {d.values.slice(0, 4).map((v) => (
                              <span key={v} className="dossier-chip">
                                {v}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <strong>{d.value}</strong>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}

            {summary.careerEras.length > 0 && !isWork && (
              <section className="kg-dash-card">
                <h3>Career Phases</h3>
                <div className="kg-phase-rail">
                  {summary.careerEras.map((era, i) => (
                    <article key={`${era.era}-${i}`} className="kg-phase-chip">
                      {era.era && <time>{era.era}</time>}
                      <span>{era.title}</span>
                    </article>
                  ))}
                </div>
                {onNavigateTab && dossier.availableTabs.includes('career') && (
                  <button type="button" className="kg-link-btn" onClick={() => onNavigateTab('career')}>
                    Explore full career →
                  </button>
                )}
              </section>
            )}

            <div className="kg-featured-row">
              {summary.topWorks.length > 0 && (
                <section className="kg-dash-card kg-featured-card">
                  <header className="kg-featured-head">
                    <h3>{featuredTitle}</h3>
                    {dossier.works.totalCount > summary.topWorks.length && onNavigateTab && (
                      <button type="button" className="kg-link-btn" onClick={() => onNavigateTab('works')}>
                        All {dossier.works.totalCount} →
                      </button>
                    )}
                  </header>
                  <ol className="kg-ranked-list">
                    {summary.topWorks.map((w, i) => (
                      <li key={`${w.title}-${i}`}>
                        <span className="kg-rank">{i + 1}</span>
                        <div>
                          <strong>{w.title}</strong>
                          {w.year && <span className="kg-rank-meta">{w.year}</span>}
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {summary.topAwards.length > 0 && (
                <section className="kg-dash-card kg-featured-card kg-awards-featured">
                  <header className="kg-featured-head">
                    <h3>{awardsTitle}</h3>
                    {dossier.awards.won.length > summary.topAwards.length && onNavigateTab && (
                      <button type="button" className="kg-link-btn" onClick={() => onNavigateTab('awards')}>
                        All {dossier.awards.won.length} →
                      </button>
                    )}
                  </header>
                  <ul className="kg-medal-list">
                    {summary.topAwards.map((a, i) => (
                      <li key={`${a.name}-${i}`}>
                        <span className="kg-medal" aria-hidden>
                          ★
                        </span>
                        <div>
                          <strong>{a.name}</strong>
                          {a.year && <span className="kg-rank-meta">{a.year}</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>

          <aside className="kg-dashboard-aside">
            {summary.quote && (
              <blockquote className="kg-aside-quote kg-trivia-card">
                <span className="kg-trivia-label">Did you know?</span>
                <p>{summary.quote}</p>
                <footer className="kg-trivia-foot">From Wikidata · cross-checked profile</footer>
              </blockquote>
            )}

            <section className="kg-dash-card kg-sources-mini">
              <h3>Also in</h3>
              <div className="kg-source-pills">
                {dossier.wikipediaUrl && (
                  <a href={dossier.wikipediaUrl} target="_blank" rel="noreferrer">
                    Wikipedia
                  </a>
                )}
                {dossier.wikidataUrl && (
                  <a href={dossier.wikidataUrl} target="_blank" rel="noreferrer">
                    Wikidata
                  </a>
                )}
                {summary.imdbUrl && (
                  <a href={summary.imdbUrl} target="_blank" rel="noreferrer">
                    IMDb
                  </a>
                )}
              </div>
            </section>

            {summary.familyPreview.length > 0 && (
              <section className="kg-dash-card">
                <h3>Family</h3>
                <ul className="kg-family-compact">
                  {summary.familyPreview.slice(0, 5).map((m, i) => (
                    <li key={`${m.relation}-${m.name}-${i}`}>
                      <span>{m.relation}</span>
                      <strong>{m.name}</strong>
                    </li>
                  ))}
                </ul>
                {dossier.family.members.length > 5 && onNavigateTab && (
                  <button type="button" className="kg-link-btn" onClick={() => onNavigateTab('family')}>
                    View family →
                  </button>
                )}
              </section>
            )}

            {summary.website && (
              <section className="kg-dash-card kg-website-card">
                <h3>Official Site</h3>
                <a href={summary.website} target="_blank" rel="noreferrer">
                  {summary.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}

export function LifePanel({ dossier }: { dossier: EntityDossier }) {
  const { life } = dossier
  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>Life</h2>
          <p className="dossier-panel-desc">Birth, background, education, and milestones</p>
        </div>
      </header>

      {life.timeline.length > 0 && (
        <section className="dossier-section-block">
          <h3 className="dossier-section-title">Timeline</h3>
          <div className="dossier-timeline-rail">
            {life.timeline.map((m, i) => (
              <article key={i} className="dossier-milestone">
                <div className="dossier-milestone-dot" />
                <div className="dossier-milestone-card">
                  {m.year && <time>{m.year}</time>}
                  <strong>{m.label}</strong>
                  {m.detail && <p>{m.detail}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {life.narrative && (
        <section className="dossier-section-block">
          <h3 className="dossier-section-title">Background</h3>
          <ExpandableProse text={life.narrative} />
        </section>
      )}

      {life.facts.length > 0 && (
        <section className="dossier-section-block">
          <h3 className="dossier-section-title">Details</h3>
          <HighlightTiles
            facts={life.facts.map((g) => ({ label: g.label, value: g.values.join(', ') }))}
          />
        </section>
      )}
    </div>
  )
}

export function CareerPanel({ dossier }: { dossier: EntityDossier }) {
  const { career } = dossier
  const title = dossier.kind === 'work' ? 'Cast & Crew' : dossier.kind === 'org' ? 'Business' : 'Career'
  const desc =
    dossier.kind === 'work'
      ? 'Director, writers, producers, and creative team'
      : dossier.kind === 'org'
        ? 'Leadership, scale, and industry footprint'
        : 'Profession, roles, and creative work'

  const formattedFacts = career.facts.map((g) => {
    const f = formatFactDisplay(g.label, g.values)
    return { label: f.label, value: f.display, values: f.values }
  })

  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>{title}</h2>
          <p className="dossier-panel-desc">{desc}</p>
        </div>
        {career.summary && <span className="dossier-header-pill">{career.summary}</span>}
      </header>

      {career.narrative && (
        <section className="kg-ai-narrative">
          <span className="kg-ai-label">Synthesized overview</span>
          <p>{career.narrative}</p>
        </section>
      )}

      {career.subtracks.length > 0 && (
        <div className="dossier-subtrack-grid">
          {career.subtracks.map((st) => (
            <article key={st.id} className="dossier-subtrack-card">
              <h3>{st.title}</h3>
              {st.summary && <p>{st.summary}</p>}
              {st.highlights.length > 0 && (
                <div className="dossier-chip-row">
                  {st.highlights.map((h) => (
                    <span key={h} className="dossier-chip">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {formattedFacts.length > 0 && (
        <section className="dossier-section-block">
          <h3 className="dossier-section-title">Key figures</h3>
          <HighlightTiles facts={formattedFacts} />
        </section>
      )}
    </div>
  )
}

export function FamilyPanel({ dossier }: { dossier: EntityDossier }) {
  const { family } = dossier
  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>Family</h2>
          <p className="dossier-panel-desc">Parents, partners, children, and relatives</p>
        </div>
      </header>

      {family.narrative && <ExpandableProse text={family.narrative} limit={480} />}

      {family.members.length > 0 ? (
        <div className="dossier-family-grid">
          {family.members.map((m, i) => (
            <article key={`${m.relation}-${m.name}-${i}`} className="dossier-family-card">
              <div className="dossier-family-avatar" aria-hidden>
                {m.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <span className="dossier-family-rel">{m.relation}</span>
                <strong>{m.name}</strong>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="dossier-empty muted">No family relationships recorded in linked sources.</p>
      )}
    </div>
  )
}

export function WorksPanel({ dossier }: { dossier: EntityDossier }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? dossier.works.items : dossier.works.items.slice(0, 12)
  const title = dossier.kind === 'work' ? 'Cast & Crew' : 'Works'
  const desc =
    dossier.kind === 'work'
      ? `${dossier.works.totalCount} cast & crew from Wikidata`
      : `${dossier.works.totalCount} credits from Wikidata`

  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>{title}</h2>
          <p className="dossier-panel-desc">{desc}</p>
        </div>
      </header>

      <div className="dossier-works-grid">
        {visible.map((w, i) => (
          <article
            key={`${w.title}-${i}`}
            className="dossier-work-card"
            style={{ '--work-hue': w.year ? `${(parseInt(w.year, 10) % 12) * 30}` : '210' } as CSSProperties}
          >
            {w.year && <span className="dossier-work-year">{w.year}</span>}
            <h3>{w.title}</h3>
            {w.role && <span className="dossier-work-role">{w.role}</span>}
          </article>
        ))}
      </div>
      {dossier.works.items.length > 12 && !showAll && (
        <button type="button" className="eh-btn ghost dossier-load-more" onClick={() => setShowAll(true)}>
          Show all {dossier.works.totalCount} works
        </button>
      )}
    </div>
  )
}

export function AwardsPanel({ dossier }: { dossier: EntityDossier }) {
  const { awards } = dossier
  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>Awards</h2>
          <p className="dossier-panel-desc">Honours and nominations</p>
        </div>
      </header>

      <div className="dossier-awards-cols">
        <section className="dossier-award-col won">
          <h3>
            <span className="dossier-award-icon">★</span> Won
            <em>{awards.won.length}</em>
          </h3>
          <ul className="dossier-award-list">
            {awards.won.map((a, i) => (
              <li key={i}>
                {a.year && <span className="dossier-award-year">{a.year}</span>}
                <span>{a.name}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="dossier-award-col nominated">
          <h3>
            <span className="dossier-award-icon">○</span> Nominated
            <em>{awards.nominated.length}</em>
          </h3>
          <ul className="dossier-award-list">
            {awards.nominated.map((a, i) => (
              <li key={i}>
                {a.year && <span className="dossier-award-year">{a.year}</span>}
                <span>{a.name}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

export function SourcesPanel({ dossier }: { dossier: EntityDossier }) {
  return (
    <div className="dossier-panel dossier-panel-rich">
      <header className="dossier-panel-header">
        <div>
          <h2>Sources</h2>
          <p className="dossier-panel-desc">Full articles and raw linked data</p>
        </div>
      </header>

      <div className="dossier-source-cards">
        {dossier.sources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className={`dossier-source-card source-${s.source}`}
          >
            <span className="dossier-source-name">{s.label}</span>
            <span className="dossier-source-type">{s.source}</span>
            <span className="dossier-source-arrow">↗</span>
          </a>
        ))}
      </div>

      {dossier.wikipediaUrl && (
        <p className="dossier-wiki-hint muted">
          Open Wikipedia for the complete long-form biography. This dossier is a structured,
          category-based summary.
        </p>
      )}
    </div>
  )
}
