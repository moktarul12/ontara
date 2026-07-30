import { useMemo } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { facetsForKind, type FacetId } from '../types/facets'

interface Props {
  store: OntologyStore
  onFamilyLayout?: () => void
}

const DEPTHS = [1, 2, 3, 4, 5] as const

export function FacetBar({ store, onFamilyLayout }: Props) {
  const {
    entityKind,
    expandedFacets,
    expandFacet,
    loading,
    pathRootId,
    graph,
    config,
    viewMode,
    familyDepth,
    openFamilyTree,
    exitFamilyTree,
    setFamilyDepth,
    openImdbView,
    exitImdbView,
    imdbUrl,
  } = store

  const facets = useMemo(() => facetsForKind(entityKind), [entityKind])
  const rootLabel =
    graph.nodes.find((n) => n.id === pathRootId)?.label || config.seedLabel || 'Entity'

  if (!pathRootId || config.startMode === 'classmap') {
    return null
  }

  if (entityKind !== 'person' && entityKind !== 'org' && entityKind !== 'work') {
    return null
  }

  const isFamily = viewMode === 'family'
  const isImdb = viewMode === 'imdb'
  const isPerson = entityKind === 'person'
  const isWork = entityKind === 'work'

  const kicker = isFamily
    ? 'Family tree'
    : isImdb
      ? 'IMDb ontology'
      : entityKind === 'person'
        ? 'Person lenses'
        : entityKind === 'work'
          ? 'Title lenses'
          : 'Org lenses'

  const hint = isFamily
    ? 'Parents above · children below · spouses & siblings beside'
    : isImdb
      ? 'Cast · crew · music · genre · production — entertainment graph'
      : entityKind === 'person'
        ? 'Deepen family, career, awards, or politics — or open a full family tree'
        : entityKind === 'work'
          ? 'Cast, crew, soundtrack, genre — or load full IMDb-style ontology'
          : 'Leadership, identity, subsidiaries'

  return (
    <div className="facet-bar" role="toolbar" aria-label="Knowledge facets">
      <div className="facet-bar-head">
        <p className="facet-kicker">{kicker}</p>
        <h2 className="facet-title">{rootLabel}</h2>
        <p className="facet-hint">{hint}</p>
      </div>

      <div className="facet-bar-actions">
        {isPerson && (
          <div className="family-tree-controls">
            <div className="family-depth" role="group" aria-label="Family generations">
              <span className="family-depth-label">Gen</span>
              {DEPTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`family-depth-btn ${familyDepth === n ? 'on' : ''}`}
                  disabled={loading}
                  onClick={() => {
                    setFamilyDepth(n)
                    if (isFamily) {
                      void openFamilyTree(n).then(() => onFamilyLayout?.())
                    }
                  }}
                  title={`${n} generation${n === 1 ? '' : 's'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {isFamily ? (
              <button
                type="button"
                className="family-tree-btn ghost-tree"
                disabled={loading}
                onClick={() => void exitFamilyTree()}
              >
                Back to dossier
              </button>
            ) : (
              <button
                type="button"
                className="family-tree-btn"
                disabled={loading}
                onClick={() => void openFamilyTree(familyDepth).then(() => onFamilyLayout?.())}
                title="Load multi-generation family ontology"
              >
                Family tree
              </button>
            )}
          </div>
        )}

        {isWork && (
          <div className="family-tree-controls">
            {imdbUrl && (
              <a
                className="imdb-ext-link"
                href={imdbUrl}
                target="_blank"
                rel="noreferrer"
                title="Open on IMDb"
              >
                IMDb ↗
              </a>
            )}
            {isImdb ? (
              <button
                type="button"
                className="family-tree-btn ghost-tree"
                disabled={loading}
                onClick={() => void exitImdbView()}
              >
                Back to dossier
              </button>
            ) : (
              <button
                type="button"
                className="family-tree-btn imdb-btn"
                disabled={loading}
                onClick={() => void openImdbView()}
                title="Load full cast / crew / music / genre ontology"
              >
                IMDb ontology
              </button>
            )}
          </div>
        )}

        {!isFamily && !isImdb && facets.length > 0 && (
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
        )}
      </div>
    </div>
  )
}
