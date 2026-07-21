import { ConnectionBar } from './components/ConnectionBar'
import { ExplorePanel } from './components/ExplorePanel'
import { GraphSearch } from './components/GraphSearch'
import { HopControls } from './components/HopControls'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { useOntologyStore } from './hooks/useOntologyStore'

export default function App() {
  const store = useOntologyStore()
  const hasGraph = store.graph.nodes.length > 0
  const isClassMap = store.config.startMode === 'classmap' && hasGraph

  const onNodeClick = (nodeId: string, type?: string) => {
    if (isClassMap && type === 'class') {
      void store.selectNode(nodeId)
    } else {
      void store.openKnowledgeGraph(nodeId)
    }
  }

  return (
    <div className="app-shell">
      <ConnectionBar
        endpoint={store.config.endpoint}
        loading={store.loading}
        onChangeEndpoint={(endpoint) => store.setConfig({ endpoint })}
        onBrowseClasses={() => void store.bootstrap({ startMode: 'classmap' })}
        onClear={store.clearGraph}
        hasGraph={hasGraph}
      />

      <main className="workspace">
        <section className="graph-pane">
          <GraphSearch store={store} />
          <HopControls store={store} />

          <div className="stat-strip">
            {hasGraph && (
              <>
                <span>
                  <em>{store.graph.nodes.length}</em> nodes
                </span>
                <span>
                  <em>{store.graph.links.length}</em> relations
                </span>
              </>
            )}
            {isClassMap && <span className="map-pill">Ontology class map</span>}
            {store.loading && (
              <span className="loading-pill">{store.loadingMessage || 'Loading…'}</span>
            )}
            {store.lastExpandMessage && !store.loading && (
              <span className="map-pill">{store.lastExpandMessage}</span>
            )}
          </div>

          <KnowledgeGraph
            data={store.graph}
            selectedNodeId={store.selectedNodeId}
            highlightedLinkId={store.highlightedLinkId}
            graphEpoch={store.graphEpoch}
            onNodeClick={(node) => onNodeClick(node.id, node.type)}
          />
        </section>

        <ExplorePanel store={store} />
      </main>

      {store.error && (
        <div className="toast error" role="alert">
          <span>{store.error}</span>
          <button type="button" onClick={store.clearError}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
