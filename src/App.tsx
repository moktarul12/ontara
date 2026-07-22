import { useEffect, useState } from 'react'
import { ConnectionBar } from './components/ConnectionBar'
import { ExplorePanel } from './components/ExplorePanel'
import { GraphFooter } from './components/GraphFooter'
import { GraphSearch } from './components/GraphSearch'
import { KnowledgeGraph } from './components/KnowledgeGraph'
import { useOntologyStore } from './hooks/useOntologyStore'
import { SPARQL_SOURCES, type SparqlSourceId } from './types/ontology'

export default function App() {
  const store = useOntologyStore()
  const hasGraph = store.graph.nodes.length > 0
  const isClassMap = store.config.startMode === 'classmap' && hasGraph
  const isResource = store.config.startMode === 'resource' && hasGraph
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [suggestOpen, setSuggestOpen] = useState(false)

  useEffect(() => {
    void store.bootstrap({ startMode: 'classmap' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  useEffect(() => {
    if (isResource) setPanelCollapsed(false)
  }, [store.config.seedUri, isResource])

  const onNodeClick = (nodeId: string) => {
    // Click selects the node and loads its relations — does not reset the graph
    void store.selectNode(nodeId)
    setPanelCollapsed(false)
  }

  const onChangeSource = (source: SparqlSourceId) => {
    const endpoint =
      SPARQL_SOURCES.find((s) => s.id === source)?.endpoint ?? store.config.endpoint
    store.setConfig({ source, endpoint, seedUri: '', seedLabel: '', startMode: 'classmap' })
    void store.bootstrap({ source, endpoint, startMode: 'classmap' })
  }

  return (
    <div className="app-shell">
      <ConnectionBar
        endpoint={store.config.endpoint}
        source={store.config.source}
        loading={store.loading}
        onChangeSource={onChangeSource}
        onBrowseClasses={() => void store.bootstrap({ startMode: 'classmap' })}
        onClear={() => {
          store.clearGraph()
          void store.bootstrap({ startMode: 'classmap' })
        }}
        hasGraph={hasGraph}
      />

      <main className={`workspace ${panelCollapsed ? 'panel-collapsed' : ''}`}>
        <div className="stage-column">
          <GraphSearch
            store={store}
            showExamples={isClassMap && !store.loading}
            onSuggestOpenChange={setSuggestOpen}
          />

          <section className="canvas-frame">
            {isClassMap && !store.loading && !suggestOpen && (
              <div className="map-guide">
                <p>
                  Browse the{' '}
                  <strong>{store.config.source === 'wikidata' ? 'Wikidata' : 'DBpedia'}</strong>{' '}
                  class map, or search a person / place above.
                </p>
              </div>
            )}

            <KnowledgeGraph
              data={store.graph}
              selectedNodeId={store.selectedNodeId}
              highlightedLinkId={store.highlightedLinkId}
              graphEpoch={store.graphEpoch}
              layoutKey={layoutKey}
              fitKey={fitKey}
              onNodeClick={(node) => onNodeClick(node.id)}
            />
          </section>

          <GraphFooter
            nodeCount={store.graph.nodes.length}
            linkCount={store.graph.links.length}
            sourceLabel={store.config.source === 'wikidata' ? 'Wikidata' : 'DBpedia'}
            isClassMap={isClassMap}
            loading={store.loading}
            loadingMessage={store.loadingMessage}
            lastMessage={store.lastExpandMessage}
            onFitView={() => setFitKey((k) => k + 1)}
            onResetLayout={() => setLayoutKey((k) => k + 1)}
          />
        </div>

        <ExplorePanel
          store={store}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((c) => !c)}
        />
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
