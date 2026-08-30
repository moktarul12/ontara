import { useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { MAX_ONTOLOGY_HOPS, isRelationHubId } from '../services/ontologyHops'
import type { HopDirection } from '../services/sparql'
import { SPARQL_SOURCES, type SparqlSourceId } from '../types/ontology'
import { GraphSearch } from './GraphSearch'
import { facetsForKind, type FacetId } from '../types/facets'

interface Props {
  store: OntologyStore
  onChangeSource: (source: SparqlSourceId) => void
  onHome: () => void
  onFamilyLayout?: () => void
}

/**
 * Slim studio chrome:
 * brand + search | hops dropdown + direction | Graph / Family / Movies | source
 */
export function StudioHorizon({ store, onChangeSource, onHome, onFamilyLayout }: Props) {
  const {
    applyHops,
    shrinkHops,
    loading,
    graph,
    appliedHopDepth,
    pathRootId,
    selectedNode,
    config,
    entityKind,
    viewMode,
    familyDepth,
    openFamilyTree,
    exitFamilyTree,
    openImdbView,
    exitImdbView,
    imdbUrl,
    expandedFacets,
    expandFacet,
  } = store

  const [direction, setDirection] = useState<HopDirection>('both')

  const hopRoot =
    (pathRootId && graph.nodes.some((n) => n.id === pathRootId) ? pathRootId : null) ||
    (selectedNode &&
    !isRelationHubId(selectedNode.id) &&
    !selectedNode.id.startsWith('literal:')
      ? selectedNode.id
      : null)

  const canHop = !!hopRoot && graph.nodes.length > 0 && viewMode === 'dossier'
  const depth = appliedHopDepth
  const isFamily = viewMode === 'family'
  const isImdb = viewMode === 'imdb'
  const isPerson = entityKind === 'person'
  const isWork = entityKind === 'work'
  const facets = useMemo(() => facetsForKind(entityKind), [entityKind])
  const showLenses = (isPerson || isWork || entityKind === 'org') && !isFamily && !isImdb
  const rootLabel =
    graph.nodes.find((n) => n.id === pathRootId)?.label || config.seedLabel || ''

  const setDepth = (n: number) => {
    if (!canHop) return
    if (n === depth) return
    if (n < depth) shrinkHops(depth - n)
    else void applyHops(n, direction)
  }

  const goGraph = () => {
    if (isFamily) void exitFamilyTree()
    else if (isImdb) void exitImdbView()
  }

  return (
    <header className="horizon" aria-label="Studio controls">
      <div className="horizon-bar">
        <div className="horizon-brand-search">
          <button type="button" className="horizon-brand" onClick={onHome} title="Home">
            <span className="horizon-orb" aria-hidden />
            <span className="horizon-word">Ontopedian</span>
          </button>
          <div className="horizon-search">
            <GraphSearch store={store} variant="compact" />
          </div>
        </div>

        <div className="horizon-cluster hops-cluster" aria-label="Hop depth">
          <label className="hop-select-wrap">
            <span className="hop-select-label">How far</span>
            <select
              className="hop-select"
              value={depth}
              disabled={loading || !canHop}
              onChange={(e) => setDepth(Number(e.target.value))}
              title="How many steps of connections to show"
            >
              {Array.from({ length: MAX_ONTOLOGY_HOPS + 1 }, (_, i) => i).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="flow-mini" role="group" aria-label="Link direction">
            {(
              [
                { id: 'in' as const, label: 'In' },
                { id: 'both' as const, label: 'Both' },
                { id: 'out' as const, label: 'Out' },
              ] as const
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`flow-mini-btn ${direction === d.id ? 'on' : ''}`}
                disabled={loading || !canHop}
                onClick={() => {
                  setDirection(d.id)
                  if (canHop && depth > 0) void applyHops(depth, d.id)
                }}
                title={
                  d.id === 'in'
                    ? 'Incoming links'
                    : d.id === 'out'
                      ? 'Outgoing links'
                      : 'Both directions'
                }
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="horizon-cluster view-cluster" role="group" aria-label="View mode">
          <button
            type="button"
            className={`view-mode-btn ${viewMode === 'dossier' ? 'on' : ''}`}
            disabled={loading}
            onClick={goGraph}
          >
            Graph
          </button>
          {isPerson && (
            <button
              type="button"
              className={`view-mode-btn ${isFamily ? 'on' : ''}`}
              disabled={loading}
              onClick={() => {
                if (isFamily) void exitFamilyTree()
                else void openFamilyTree(familyDepth).then(() => onFamilyLayout?.())
              }}
              title="Parents, children, spouses"
            >
              Family tree
            </button>
          )}
          {isWork && config.source === 'wikidata' && (
            <button
              type="button"
              className={`view-mode-btn ${isImdb ? 'on' : ''}`}
              disabled={loading}
              onClick={() => {
                if (isImdb) void exitImdbView()
                else void openImdbView()
              }}
              title="Cast, crew, production"
            >
              Movie credits
            </button>
          )}
        </div>

        <div className="horizon-cluster source-cluster" role="group" aria-label="Source">
          {SPARQL_SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`src-mini ${config.source === s.id ? 'on' : ''} src-${s.id}`}
              disabled={loading}
              onClick={() => onChangeSource(s.id)}
              title={s.label}
            >
              {s.id === 'wikidata' ? 'Wiki' : s.id === 'dbpedia' ? 'DB' : 'YAGO'}
            </button>
          ))}
          {isImdb && imdbUrl && (
            <a className="src-imdb-ext" href={imdbUrl} target="_blank" rel="noreferrer">
              IMDb ↗
            </a>
          )}
        </div>
      </div>

      {pathRootId && (showLenses || rootLabel) && config.startMode !== 'classmap' && (
        <div className="horizon-lenses">
          {rootLabel && (
            <span className="horizon-entity" title={rootLabel}>
              {rootLabel}
            </span>
          )}
          <span className="horizon-hint">Click a name · links on the map · facts on the right</span>
          {showLenses &&
            facets.map((f) => {
              const on = expandedFacets.includes(f.id as FacetId)
              return (
                <button
                  key={f.id}
                  type="button"
                  className={`lens-chip ${on ? 'on' : ''}`}
                  disabled={loading}
                  title={f.hint}
                  onClick={() => void expandFacet(f.id)}
                >
                  {f.label}
                </button>
              )
            })}
        </div>
      )}
    </header>
  )
}
