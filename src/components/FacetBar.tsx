import { useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { facetsForKind, type FacetId } from '../types/facets'

interface Props {
  store: OntologyStore
  onFamilyLayout?: () => void
  /** Vertical layout for the right insight flyer */
  variant?: 'bar' | 'flyer'
  onExpanded?: () => void
}

const DEPTHS = [1, 2, 3, 4, 5] as const

export function FacetBar({
  store,
  onFamilyLayout,
  variant = 'bar',
  onExpanded,
}: Props) {
  const {
    entityKind,
    expandedFacets,
    expandFacet,
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
    lastExpandMessage,
    clearExpandMessage,
  } = store

  const [expanding, setExpanding] = useState<FacetId | null>(null)

  const facets = useMemo(() => facetsForKind(entityKind), [entityKind])
  const rootLabel =
    graph.nodes.find((n) => n.id === pathRootId)?.label || config.seedLabel || 'Entity'

  if (!pathRootId || config.startMode === 'classmap') {
    return null
  }

  if (entityKind !== 'person' && entityKind !== 'org' && entityKind !== 'work') {
    return null
  }

  const isFlyer = variant === 'flyer'
  const isFamily = viewMode === 'family'
  const isImdb = viewMode === 'imdb'
  const isPerson = entityKind === 'person'
  const isWork = entityKind === 'work'

  const kicker = isFamily
    ? 'Family tree'
    : isImdb
      ? 'IMDb ontology'
      : entityKind === 'person'
        ? 'Grow the graph'
        : entityKind === 'work'
          ? 'Film map'
          : 'Org map'

  const hint = isFamily
    ? 'Parents above · children below · spouses & siblings beside'
    : isImdb
      ? 'Cast · crew · music · genre · production'
      : entityKind === 'person'
        ? 'Tap a topic to add linked people, places, and facts to the graph'
        : entityKind === 'work'
          ? 'Tap cast, crew, genre, etc. to grow the film map'
          : 'Tap a topic to add leadership, subsidiaries, and facts to the graph'

  const runFacet = async (facetId: FacetId) => {
    setExpanding(facetId)
    try {
      await expandFacet(facetId)
      onExpanded?.()
    } finally {
      setExpanding(null)
    }
  }

  return (
    <section
      className={`facet-bar ${isFlyer ? 'facet-flyer' : ''}`}
      role="toolbar"
      aria-label="Knowledge facets"
    >
      <div className="facet-flyer-head">
        <p className="facet-kicker">{kicker}</p>
        {!isFlyer && <h2 className="facet-title">{rootLabel}</h2>}
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
                  disabled={Boolean(expanding)}
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
                disabled={Boolean(expanding)}
                onClick={() => void exitFamilyTree()}
              >
                Back to dossier
              </button>
            ) : (
              <button
                type="button"
                className="family-tree-btn"
                disabled={Boolean(expanding)}
                onClick={() =>
                  void openFamilyTree(familyDepth).then(() => {
                    onFamilyLayout?.()
                    onExpanded?.()
                  })
                }
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
                disabled={Boolean(expanding)}
                onClick={() => void exitImdbView()}
              >
                Back to dossier
              </button>
            ) : (
              <button
                type="button"
                className="family-tree-btn imdb-btn"
                disabled={Boolean(expanding)}
                onClick={() => {
                  void openImdbView().then(() => onExpanded?.())
                }}
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
              const busy = expanding === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`facet-chip ${on ? 'on' : ''}`}
                  title={f.hint}
                  disabled={Boolean(expanding && !busy)}
                  aria-busy={busy}
                  onClick={() => void runFacet(f.id)}
                >
                  <span className="facet-chip-label">{f.label}</span>
                  <span className="facet-chip-hint">
                    {busy ? 'Adding…' : on ? 'On map · deepen' : f.hint}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {lastExpandMessage && (
        <p className="facet-toast" role="status">
          {lastExpandMessage}
          <button type="button" className="facet-toast-dismiss" onClick={clearExpandMessage}>
            ×
          </button>
        </p>
      )}
    </section>
  )
}
