import { SPARQL_SOURCES, type SparqlSourceId } from '../types/ontology'
import { GraphSearch } from './GraphSearch'
import type { OntologyStore } from '../hooks/useOntologyStore'

interface Props {
  store: OntologyStore
  onChangeSource: (source: SparqlSourceId) => void
}

export function HomeLanding({ store, onChangeSource }: Props) {
  const source = store.config.source

  return (
    <section className="home" aria-label="Ontara home">
      <div className="home-sky" aria-hidden>
        <span className="home-orb home-orb-a" />
        <span className="home-orb home-orb-b" />
        <span className="home-constellation" />
      </div>

      <header className="home-top">
        <div className="brand brand-home">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">Ontara</span>
        </div>
        <div className="source-toggle" role="group" aria-label="Knowledge source">
          {SPARQL_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`source-btn ${source === s.id ? 'active' : ''}`}
              disabled={store.loading}
              onClick={() => onChangeSource(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </header>

      <div className="home-hero">
        <h1 className="home-title">
          Ontara
          <span className="home-title-em"> map what connects</span>
        </h1>
        <p className="home-lede">
          Search a person, place, film, or song. Open a living knowledge graph —
          follow relations, deepen facets, grow hops.
        </p>

        <GraphSearch store={store} variant="hero" showExamples />
      </div>
    </section>
  )
}
