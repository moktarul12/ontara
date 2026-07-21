import type { OntologyStore } from '../hooks/useOntologyStore'

interface Props {
  store: OntologyStore
}

export function ExplorePanel({ store }: Props) {
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
    addSingleNeighbor,
    showDetails,
    showRelations,
    lastExpandMessage,
    graph,
  } = store

  if (!selectedNode) {
    return (
      <aside className="side-panel">
        <div className="panel-empty">
          <p className="eyebrow">Information</p>
          <h2>{graph.nodes.length ? 'Select a node' : 'Start with search'}</h2>
          <p>
            {graph.nodes.length
              ? 'Click any node to open its full knowledge graph and details.'
              : 'Search a person or entity above. Their complete graph and data properties will appear here.'}
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside className="side-panel">
      <div className="panel-head">
        <p className="eyebrow">
          Focused {selectedNode.type === 'class' ? 'class' : 'entity'}
        </p>
        <h2 title={selectedNode.uri}>{selectedNode.label}</h2>
        {selectedNode.classes?.length ? (
          <div className="class-tags">
            {selectedNode.classes.slice(0, 4).map((c) => (
              <span key={c} className="tag">
                {c}
              </span>
            ))}
          </div>
        ) : null}
        <div className="panel-tabs">
          <button
            type="button"
            className={panelMode === 'details' ? 'active' : ''}
            onClick={showDetails}
          >
            Data
          </button>
          <button
            type="button"
            className={panelMode === 'relations' || panelMode === 'neighbors' ? 'active' : ''}
            onClick={showRelations}
          >
            Relations
          </button>
        </div>
      </div>

      {panelMode === 'details' && <DataPropertiesView store={store} />}

      {(panelMode === 'relations' || panelMode === 'neighbors') && (
        <div className="panel-body">
          {lastExpandMessage && (
            <div className="expand-toast" role="status">
              {lastExpandMessage}
            </div>
          )}

          {panelMode === 'neighbors' && activeRelation ? (
            <>
              <button type="button" className="back-link" onClick={showRelations}>
                ← All relation types
              </button>
              <div className="relation-banner">
                <span className={`dir ${activeRelation.direction}`}>
                  {activeRelation.direction === 'out' ? 'outgoing' : 'incoming'}
                </span>
                <strong>{activeRelation.predicateLabel}</strong>
                <span className="muted">{neighbors.length} listed</span>
              </div>

              <div className="bulk-bar">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={
                      neighbors.length > 0 &&
                      selectedNeighborUris.size === neighbors.length
                    }
                    onChange={(e) => selectAllNeighbors(e.target.checked)}
                  />
                  Select all
                </label>
                <button
                  type="button"
                  className="primary compact"
                  disabled={!selectedNeighborUris.size}
                  onClick={addSelectedNeighbors}
                >
                  Add {selectedNeighborUris.size || ''} to graph
                </button>
              </div>

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
                        </span>
                      </label>
                      <button
                        type="button"
                        className="ghost compact"
                        disabled={onGraph}
                        onClick={() => addSingleNeighbor(n)}
                      >
                        {onGraph ? 'On graph' : '+ Edge'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <>
              <p className="panel-lead">
                Grow the graph further with <strong>Expand</strong>, or click a neighbor on
                the canvas to open their full knowledge graph.
              </p>
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
                            {r.predicate.replace(/^https?:\/\//, '').slice(0, 42)}
                          </span>
                        </span>
                        <div className="rel-actions">
                          <button
                            type="button"
                            className="primary compact"
                            disabled={loading}
                            onClick={() => void expandRelation(r)}
                          >
                            Expand
                          </button>
                          <button
                            type="button"
                            className="ghost compact"
                            disabled={loading}
                            onClick={() => void openRelation(r)}
                          >
                            List
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
      p.predicateLabel.toLowerCase() === 'comment',
  )
  const rest = dataProperties.filter((p) => p !== abstract)

  return (
    <div className="panel-body">
      <p className="panel-lead">Complete literal properties for this entity.</p>
      {selectedNode && (
        <a className="uri-link" href={selectedNode.uri} target="_blank" rel="noreferrer">
          {selectedNode.uri}
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
          {abstract.value.slice(0, 900)}
          {abstract.value.length > 900 ? '…' : ''}
        </blockquote>
      )}
      <dl className="prop-grid">
        {rest.map((p, i) => (
          <div key={`${p.predicate}-${i}`} className="prop-row">
            <dt title={p.predicate}>{p.predicateLabel}</dt>
            <dd>
              {p.value.length > 220 ? `${p.value.slice(0, 218)}…` : p.value}
              {p.lang ? <span className="lang">{p.lang}</span> : null}
            </dd>
          </div>
        ))}
      </dl>
      {!loading && !dataProperties.length && (
        <p className="empty-note">No literal properties returned.</p>
      )}
    </div>
  )
}
