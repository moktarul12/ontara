import type { EntityDossier } from '../../types/entityDossier'

const SOURCE_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  wikipedia: 'Wikipedia',
  dbpedia: 'DBpedia',
  web: 'Web',
  imdb: 'IMDb',
}

const SOURCE_BLURBS: Record<string, string> = {
  wikidata: 'Structured facts & identifiers',
  wikipedia: 'Encyclopedia article & references',
  dbpedia: 'Linked-data abstract',
  web: 'Official presence',
  imdb: 'Film & TV database',
}

export function SourcesProvenance({
  dossier,
  compact = false,
  onSeeAll,
}: {
  dossier: EntityDossier
  compact?: boolean
  onSeeAll?: () => void
}) {
  const primaryLinks = [
    dossier.wikipediaUrl && {
      label: 'Wikipedia',
      url: dossier.wikipediaUrl,
      type: 'wikipedia',
      blurb: SOURCE_BLURBS.wikipedia,
    },
    dossier.wikidataUrl && {
      label: 'Wikidata',
      url: dossier.wikidataUrl,
      type: 'wikidata',
      blurb: SOURCE_BLURBS.wikidata,
    },
    dossier.summary.website && {
      label: 'Official site',
      url: dossier.summary.website,
      type: 'web',
      blurb: SOURCE_BLURBS.web,
    },
    dossier.summary.imdbUrl && {
      label: 'IMDb',
      url: dossier.summary.imdbUrl,
      type: 'imdb',
      blurb: SOURCE_BLURBS.imdb,
    },
  ].filter(Boolean) as { label: string; url: string; type: string; blurb: string }[]

  const externalLinks = (dossier.wikipedia?.externalLinks ?? []).slice(0, compact ? 4 : 10)
  const refs = dossier.sources.slice(0, compact ? 4 : 12)
  const totalCount = primaryLinks.length + externalLinks.length + refs.length

  if (!totalCount) return null

  return (
    <section className={`kx-section kx-sources ${compact ? 'is-compact' : ''}`} id="cat-sources">
      <header className="kx-section-head">
        <div>
          <h2>Sources &amp; Provenance</h2>
          {!compact && (
            <p>
              {totalCount} reference{totalCount === 1 ? '' : 's'} across encyclopedia, structured
              data, and external links — trace any claim back to its origin.
            </p>
          )}
        </div>
        {!compact && (
          <span className="kx-sources-count-badge">{totalCount} sources</span>
        )}
        {compact && onSeeAll && (
          <button type="button" className="kx-btn-ghost kx-sources-see-all" onClick={onSeeAll}>
            Full provenance →
          </button>
        )}
      </header>

      {primaryLinks.length > 0 && (
        <div className="kx-source-links">
          {primaryLinks.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="kx-source-link">
              <span className="kx-source-link-icon">{l.label.slice(0, 1)}</span>
              <div>
                <strong>{l.label}</strong>
                <span>{l.blurb} · Open original ↗</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {externalLinks.length > 0 && (
        <div className="kx-source-external-block">
          <p className="person-section-label">External references</p>
          <ul className="kx-source-refs">
            {externalLinks.map((l) => (
              <li key={l.url}>
                <a href={l.url} target="_blank" rel="noreferrer">
                  <span className="kx-source-chip source-wikipedia">ext</span>
                  <span>{l.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {refs.length > 0 && (
        <ul className="kx-source-refs">
          {refs.map((r) => (
            <li key={r.url}>
              <a href={r.url} target="_blank" rel="noreferrer">
                <span className={`kx-source-chip source-${r.source}`}>
                  {SOURCE_LABELS[r.source] ?? r.source}
                </span>
                <span>{r.label}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {!compact && (
        <p className="kx-sources-note muted">
          AI summaries are rewritten from verified facts — never copied verbatim. Open any source to
          validate claims.
        </p>
      )}
    </section>
  )
}
