import { useEffect, useRef, useState } from 'react'
import { ConnectionBar } from './components/ConnectionBar'
import { ExplorePanel } from './components/ExplorePanel'
import { FacetBar } from './components/FacetBar'
import { GraphFooter } from './components/GraphFooter'
import { GraphSearch } from './components/GraphSearch'
import {
  KnowledgeGraph,
  type GraphLayoutMode,
  type KnowledgeGraphHandle,
} from './components/KnowledgeGraph'
import { useOntologyStore } from './hooks/useOntologyStore'
import { SPARQL_SOURCES, sourceDisplayName, type SparqlSourceId } from './types/ontology'

export default function App() {
  const store = useOntologyStore()
  const hasGraph = store.graph.nodes.length > 0
  const isClassMap = store.config.startMode === 'classmap' && hasGraph
  const isResource = store.config.startMode === 'resource' && hasGraph
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [layoutKey, setLayoutKey] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('hops')
  const [legendVisible, setLegendVisible] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const graphRef = useRef<KnowledgeGraphHandle>(null)

  useEffect(() => {
    void store.bootstrap({ startMode: 'classmap' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  useEffect(() => {
    if (isResource && !fullscreen) setPanelCollapsed(false)
  }, [store.config.seedUri, isResource, fullscreen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const onNodeClick = (nodeId: string, type?: string) => {
    if (
      type === 'literal' ||
      type === 'relation' ||
      nodeId.startsWith('literal:') ||
      nodeId.startsWith('relhub:')
    ) {
      void store.selectNode(nodeId)
      if (!fullscreen) setPanelCollapsed(false)
      return
    }
    void store.selectNode(nodeId)
    if (!fullscreen) setPanelCollapsed(false)
  }

  const onChangeSource = (source: SparqlSourceId) => {
    const endpoint =
      SPARQL_SOURCES.find((s) => s.id === source)?.endpoint ?? store.config.endpoint
    store.setConfig({ source, endpoint, seedUri: '', seedLabel: '', startMode: 'classmap' })
    void store.bootstrap({ source, endpoint, startMode: 'classmap' })
  }

  return (
    <div className={`app-shell ${fullscreen ? 'canvas-fullscreen' : ''}`}>
      {!fullscreen && (
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
      )}

      <main
        className={`workspace ${panelCollapsed || fullscreen ? 'panel-collapsed' : ''} ${fullscreen ? 'is-fullscreen' : ''}`}
      >
        <div className="stage-column">
          <GraphSearch
            store={store}
            showExamples={isClassMap && !store.loading && !fullscreen}
            onSuggestOpenChange={setSuggestOpen}
          />

          {isResource && !fullscreen && <FacetBar store={store} />}

          <section className="canvas-frame">
            {isClassMap && !store.loading && !suggestOpen && !fullscreen && (
              <div className="map-guide">
                <p>
                  Browse the{' '}
                  <strong>{sourceDisplayName(store.config.source)}</strong>{' '}
                  class map, or search a person (e.g. Amitabh Bachchan) / company for a full knowledge dossier.
                </p>
              </div>
            )}

            <KnowledgeGraph
              ref={graphRef}
              data={store.graph}
              selectedNodeId={store.selectedNodeId}
              highlightedLinkId={store.highlightedLinkId}
              graphEpoch={store.graphEpoch}
              layoutKey={layoutKey}
              fitKey={fitKey}
              pathNodeIds={store.pathNodeIds}
              pathLinkIds={store.pathLinkIds}
              layoutMode={layoutMode}
              showLegend={legendVisible}
              onNodeClick={(node) => onNodeClick(node.id, node.type)}
              onNodeExpand={(node) => {
                if (
                  node.type === 'literal' ||
                  node.type === 'relation' ||
                  node.id.startsWith('literal:') ||
                  node.id.startsWith('relhub:')
                ) {
                  void store.selectNode(node.id)
                  if (!fullscreen) setPanelCollapsed(false)
                  return
                }
                if (!fullscreen) setPanelCollapsed(false)
                void store.expandNode('both', { all: true, steps: 1, nodeId: node.id })
              }}
            />
          </section>

          <GraphFooter
            nodeCount={store.graph.nodes.length}
            linkCount={store.graph.links.length}
            sourceLabel={sourceDisplayName(store.config.source)}
            isClassMap={isClassMap}
            loading={store.loading}
            loadingMessage={store.loadingMessage}
            lastMessage={store.lastExpandMessage}
            layoutMode={layoutMode}
            legendVisible={legendVisible}
            fullscreen={fullscreen}
            onLayoutMode={setLayoutMode}
            onToggleLegend={() => setLegendVisible((v) => !v)}
            onToggleFullscreen={() => {
              setFullscreen((v) => {
                const next = !v
                if (next) setPanelCollapsed(true)
                return next
              })
            }}
            onAutoArrange={() => setLayoutKey((k) => k + 1)}
            onFitView={() => setFitKey((k) => k + 1)}
            onExportPng={() => void graphRef.current?.exportImage('png')}
            onExportJpg={() => void graphRef.current?.exportImage('jpg')}
          />
        </div>

        {!fullscreen && (
          <ExplorePanel
            store={store}
            collapsed={panelCollapsed}
            onToggleCollapse={() => setPanelCollapsed((c) => !c)}
          />
        )}
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
