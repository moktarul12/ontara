import { useMemo } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { facetsForKind, type FacetId } from '../types/facets'

interface Props {
  store: OntologyStore
}

export function FacetBar({ store }: Props) {
  const { entityKind, expandedFacets, expandFacet, loading, pathRootId, graph, config } =
    store

  const facets = useMemo(() => facetsForKind(entityKind), [entityKind])
  const rootLabel =
    graph.nodes.find((n) => n.id === pathRootId)?.label || config.seedLabel || 'Entity'

  if (!pathRootId || facets.length === 0 || config.startMode === 'classmap') {
    return null
  }

  return (
    <div className="facet-bar" role="toolbar" aria-label="Knowledge facets">
      <div className="facet-bar-head">
        <p className="facet-kicker">
          {entityKind === 'person' ? 'Person dossier' : 'Organization'}
        </p>
        <h2 className="facet-title">{rootLabel}</h2>
        <p className="facet-hint">
          {entityKind === 'person'
            ? 'Family · career · awards · politics · business — deepen any facet'
            : 'Leadership · identity — explore CEO, board, and subsidiaries'}
        </p>
      </div>
      <div className="facet-chips">
        {facets.map((f) => {
          const on = expandedFacets.includes(f.id as FacetId)
          return (
            <button
              key={f.id}
              type="button"
              className={`facet-chip ${on ? 'on' : ''}`}
              title={f.hint}
              disabled={loading}
              onClick={() => void expandFacet(f.id)}
            >
              <span className="facet-chip-label">{f.label}</span>
              <span className="facet-chip-hint">{on ? 'Deepen' : 'Expand'}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
