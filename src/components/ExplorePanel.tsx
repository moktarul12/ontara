import type { OntologyStore } from '../hooks/useOntologyStore'

interface Props {
  store: OntologyStore
  collapsed: boolean
  onToggleCollapse: () => void
}

export function ExplorePanel({ store, collapsed, onToggleCollapse }: Props) {
  const {
    selectedNode,
    panelMode,
    relationTypes,
    activeRelation,
    neighbors,
    selectedNeighborUris,
    loading,
    expandRelation,
    openRelation,
    toggleNeighbor,
    selectAllNeighbors,
    addSelectedNeighbors,
    addAllNeighbors,
    addSingleNeighbor,
    showDetails,
    showRelations,
    lastExpandMessage,
    graph,
    openKnowledgeGraph,
  } = store

  if (collapsed) {
    return (
      <aside className="inspector collapsed" aria-label="Inspector collapsed">
        <button
          type="button"
          className="inspector-rail"
          onClick={onToggleCollapse}
          title="Open inspector"
          aria-expanded={false}
        >
          <span className="rail-mark">◈</span>
          <span className="rail-label">Inspector</span>
        </button>
      </aside>
    )
  }

  if (!selectedNode) {
    return (
      <aside className="inspector">
        <header className="inspector-top">
          <div>
            <p className="inspector-kicker">Inspector</p>
            <h2 className="inspector-title quiet">Nothing selected</h2>
          </div>
          <button
            type="button"
            className="inspector-fold"
            onClick={onToggleCollapse}
            title="Collapse"
            aria-expanded
          >
            ›
          </button>
        </header>
        <div className="inspector-empty">
          <p>
            {graph.nodes.length
              ? 'Click a node on the canvas to see its relations and connected nodes.'
              : 'Search above to open an entity knowledge graph.'}
          </p>
        </div>
      </aside>
    )
  }

  const initial = (selectedNode.label.trim()[0] || '?').toUpperCase()
  const kind = selectedNode.type === 'class' ? 'Class' : 'Entity'
  const selectedCount = selectedNeighborUris.size

  return (
    <aside className="inspector">
      <header className="inspector-top">
        <div className="inspector-identity">
          <div className="mono-tile" aria-hidden>
            {initial}
          </div>
          <div className="identity-text">
            <p className="inspector-kicker">{kind}</p>
            <h2 className="inspector-title" title={selectedNode.uri}>
              {selectedNode.label}
            </h2>
            {selectedNode.classes?.length ? (
              <p className="identity-types">{selectedNode.classes.slice(0, 3).join(' · ')}</p>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="inspector-fold"
          onClick={onToggleCollapse}
          title="Collapse"
          aria-expanded
        >
          ›
        </button>
      </header>

      <nav className="inspector-tabs" aria-label="Inspector views">
        <button
          type="button"
          className={panelMode === 'relations' || panelMode === 'neighbors' ? 'on' : ''}
          onClick={showRelations}
        >
          Relations
        </button>
        <button
          type="button"
          className={panelMode === 'details' ? 'on' : ''}
          onClick={showDetails}
        >
          Data
        </button>
      </nav>

      {panelMode === 'details' && <DataPropertiesView store={store} />}

      {(panelMode === 'relations' || panelMode === 'neighbors') && (
        <div className="inspector-body">
          {lastExpandMessage && (
            <div className="expand-toast" role="status">
              {lastExpandMessage}
            </div>
          )}

          {panelMode === 'neighbors' && activeRelation ? (
            <>
              <button type="button" className="back-link" onClick={showRelations}>
                ← All relations
              </button>
              <div className="relation-banner">
                <span className={`dir ${activeRelation.direction}`}>
                  {activeRelation.direction === 'out' ? 'outgoing' : 'incoming'}
                </span>
                <strong>{activeRelation.predicateLabel}</strong>
                <span className="muted">{neighbors.length} connected</span>
              </div>

              <div className="bulk-bar stacked">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={
                      neighbors.length > 0 && selectedNeighborUris.size === neighbors.length
                    }
                    onChange={(e) => selectAllNeighbors(e.target.checked)}
                  />
                  Select all ({neighbors.length})
                </label>
                <div className="bulk-actions">
                  <button
                    type="button"
                    className="primary compact"
                    disabled={!selectedCount}
                    onClick={addSelectedNeighbors}
                  >
                    Add selected ({selectedCount})
                  </button>
                  <button
                    type="button"
                    className="ghost compact"
                    disabled={!neighbors.length}
                    onClick={addAllNeighbors}
                  >
                    Add all
                  </button>
                </div>
              </div>

              {loading && !neighbors.length ? (
                <div className="skeleton-stack">
                  <div className="skel" />
                  <div className="skel" />
                </div>
              ) : (
                <ul className="neighbor-list">
                  {neighbors.map((n) => {
                    const checked = selectedNeighborUris.has(n.uri)
                    const onGraph = store.graph.nodes.some((g) => g.id === n.uri)
                    return (
                      <li key={n.uri} className={checked ? 'selected' : ''}>
                        <label className="check grow">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleNeighbor(n.uri)}
                          />
                          <span>
                            <span className="n-label">{n.label}</span>
                            {n.typeLabel ? <span className="n-type">{n.typeLabel}</span> : null}
                            {onGraph ? <span className="n-type">on graph</span> : null}
                          </span>
                        </label>
                        <button
                          type="button"
                          className="ghost compact"
                          disabled={onGraph}
                          onClick={() => addSingleNeighbor(n)}
                        >
                          {onGraph ? '✓' : '+'}
                        </button>
                      </li>
                    )
                  })}
                  {!neighbors.length && !loading && (
                    <li className="empty-note">No connected nodes for this relation.</li>
                  )}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="panel-lead">
                Pick a relation to list connected nodes, then add selected or all to the graph.
              </p>
              {selectedNode.type !== 'class' && (
                <button
                  type="button"
                  className="ghost compact root-btn"
                  disabled={loading}
                  onClick={() => void openKnowledgeGraph(selectedNode.uri)}
                >
                  Rebuild star around this node
                </button>
              )}
              {loading && !relationTypes.length ? (
                <div className="skeleton-stack">
                  <div className="skel" />
                  <div className="skel" />
                  <div className="skel" />
                </div>
              ) : (
                <ul className="relation-list">
                  {relationTypes.map((r) => (
                    <li key={`${r.direction}:${r.predicate}:${r.predicateLabel}`}>
                      <div className="rel-row">
                        <span className={`dir ${r.direction}`}>
                          {r.direction === 'out' ? '→' : '←'}
                        </span>
                        <span className="rel-meta">
                          <span className="rel-name">{r.predicateLabel}</span>
                          <span className="rel-uri" title={r.predicate}>
                            {r.predicate.replace(/^https?:\/\//, '').slice(0, 36)}
                          </span>
                        </span>
                        <div className="rel-actions">
                          <button
                            type="button"
                            className="primary compact"
                            disabled={loading}
                            onClick={() => void openRelation(r)}
                          >
                            List
                          </button>
                          <button
                            type="button"
                            className="ghost compact"
                            disabled={loading}
                            onClick={() => void expandRelation(r)}
                            title="Add connected nodes to graph immediately"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                  {!relationTypes.length && (
                    <li className="empty-note">No relations found for this node.</li>
                  )}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </aside>
  )
}

function DataPropertiesView({ store }: { store: OntologyStore }) {
  const { dataProperties, selectedNode, loading } = store
  const abstract = dataProperties.find(
    (p) =>
      p.predicateLabel.toLowerCase() === 'abstract' ||
      p.predicate.includes('abstract') ||
      p.predicateLabel.toLowerCase() === 'comment' ||
      p.predicate.includes('description'),
  )
  const rest = dataProperties.filter((p) => p !== abstract)

  return (
    <div className="inspector-body">
      {selectedNode && (
        <a className="uri-link" href={selectedNode.uri} target="_blank" rel="noreferrer">
          Open source ↗
        </a>
      )}
      {loading && !dataProperties.length ? (
        <div className="skeleton-stack">
          <div className="skel" />
          <div className="skel" />
        </div>
      ) : null}
      {abstract && (
        <blockquote className="abstract">
          {abstract.value.slice(0, 720)}
          {abstract.value.length > 720 ? '…' : ''}
        </blockquote>
      )}
      <dl className="prop-grid">
        {rest.map((p, i) => (
          <div key={`${p.predicate}-${i}`} className="prop-row">
            <dt title={p.predicate}>{p.predicateLabel}</dt>
            <dd>
              {p.value.length > 200 ? `${p.value.slice(0, 198)}…` : p.value}
              {p.lang ? <span className="lang">{p.lang}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {!loading && !dataProperties.length && (
        <p className="empty-note">No literal properties.</p>
      )}
    </div>
  )
}
