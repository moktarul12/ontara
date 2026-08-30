import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'

const SOURCE_DESC: Record<string, string> = {
  wikipedia: 'Encyclopedia article',
  wikidata: 'Structured knowledge graph',
  dbpedia: 'Linked-data extract',
  web: 'Official website',
  imdb: 'Film & TV credits',
}

export function OverviewRightRail({
  dossier,
  onSection,
  onOpenGraph,
}: {
  dossier: EntityDossier
  onSection: (id: OverviewSectionId) => void
  onOpenGraph: () => void
}) {
  const quickFacts = dossier.hero.quickFactsCard.length
    ? dossier.hero.quickFactsCard
    : dossier.wikipedia?.infobox.slice(0, 8).map((r) => ({
        label: r.label,
        value: r.values.map((v) => v.text).join(', '),
      })) ?? []

  const trust = dossier.summary.sourceTrust
  const trustPct = trust.totalFacts
    ? Math.round((trust.confirmedCount / trust.totalFacts) * 100)
    : 0
  const trustLabel = trustPct >= 70 ? 'High' : trustPct >= 40 ? 'Medium' : 'Reported'

  const factsTitle =
    dossier.kind === 'org' ? 'Company facts' : dossier.kind === 'work' ? 'Movie facts' : 'Quick facts'

  const primarySources = [
    dossier.wikipediaUrl && { label: 'Wikipedia', url: dossier.wikipediaUrl, source: 'wikipedia' },
    dossier.wikidataUrl && { label: 'Wikidata', url: dossier.wikidataUrl, source: 'wikidata' },
    dossier.summary.website && { label: 'Official website', url: dossier.summary.website, source: 'web' },
    dossier.summary.imdbUrl && { label: 'IMDb', url: dossier.summary.imdbUrl, source: 'imdb' },
  ].filter(Boolean) as { label: string; url: string; source: string }[]

  const externalLinks = (dossier.wikipedia?.externalLinks ?? []).slice(0, 4).map((l) => ({
    label: l.label,
    url: l.url,
    source: 'wikipedia',
  }))

  const extraRefs = dossier.sources
    .filter((s) => !primarySources.some((p) => p.url === s.url))
    .slice(0, 4)
    .map((s) => ({ label: s.label, url: s.url, source: s.source }))

  const sourceLinks = [...primarySources, ...externalLinks, ...extraRefs]
  const categories = dossier.wikipedia?.categories ?? []

  return (
    <aside className="ke-right-rail" aria-label="Quick facts and sources">
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

      <section className="ke-rail-card ke-kg-card">
        <h3>Knowledge graph</h3>
        <p className="ke-rail-muted">Explore connections between people, works, and organizations.</p>
        <button type="button" className="ke-rail-btn primary" onClick={onOpenGraph}>
          Explore full graph →
        </button>
      </section>

      <section className="ke-rail-card ke-sources-rail-card">
        <header className="ke-rail-card-head">
          <h3>Sources ({sourceLinks.length})</h3>
          <span className={`ke-trust-badge ${trustLabel.toLowerCase()}`}>{trustLabel}</span>
        </header>
        <p className="ke-rail-muted ke-sources-rail-intro">
          {trust.confirmedCount} facts confirmed across {trust.sources.length} data providers
        </p>
        <ol className="ke-source-ol">
          {sourceLinks.slice(0, 10).map((s, i) => (
            <li key={s.url}>
              <span className="ke-source-num">{i + 1}</span>
              <div className="ke-source-ol-body">
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
                <span className="ke-source-ol-desc">{SOURCE_DESC[s.source] ?? s.source}</span>
              </div>
              <span className={`ke-source-chip source-${s.source}`}>{s.source}</span>
            </li>
          ))}
        </ol>
        <button type="button" className="ke-rail-btn" onClick={() => onSection('sources')}>
          Full provenance →
        </button>
        {dossier.wikipedia?.externalLinks.length ? (
          <button type="button" className="ke-rail-btn ghost" onClick={() => onSection('external')}>
            External links ({dossier.wikipedia.externalLinks.length}) →
          </button>
        ) : null}
      </section>

      {categories.length > 0 && (
        <section className="ke-rail-card">
          <h3>Related topics</h3>
          <div className="ke-topic-tags">
            {categories.map((c) => (
              <span key={c} className="ke-topic-tag">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
