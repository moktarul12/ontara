import { SPARQL_SOURCES, type SparqlSourceId } from '../types/ontology'

interface Props {
  endpoint: string
  source: SparqlSourceId
  loading: boolean
  onChangeSource: (source: SparqlSourceId) => void
  onBrowseClasses: () => void
  onClear: () => void
  hasGraph: boolean
}

export function ConnectionBar({
  endpoint,
  source,
  loading,
  onChangeSource,
  onBrowseClasses,
  onClear,
  hasGraph,
}: Props) {
  return (
    <header className="topbar slim">
      <div className="brand">
        <span className="brand-mark" aria-hidden />
        <div>
          <h1 className="brand-name">Ontara</h1>
          <p className="brand-tag">Knowledge Graph Studio</p>
        </div>
      </div>

      <div className="source-toggle" role="group" aria-label="Knowledge source">
        {SPARQL_SOURCES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`source-btn ${source === s.id ? 'active' : ''}`}
            disabled={loading}
            onClick={() => onChangeSource(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="ghost"
          disabled={loading}
          onClick={onBrowseClasses}
        >
          Browse classes
        </button>
        {hasGraph && (
          <button type="button" className="ghost" disabled={loading} onClick={onClear}>
            Reset ontology
          </button>
        )}
        <span className="endpoint-hint" title={endpoint}>
          {source === 'wikidata'
            ? 'query.wikidata.org'
            : source === 'yago'
              ? 'yago-knowledge.org'
              : 'dbpedia.org'}
        </span>
      </div>
    </header>
  )
}
