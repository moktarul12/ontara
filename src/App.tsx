import { useEffect, useRef, useState } from 'react'
import { ExplorePanel } from './components/ExplorePanel'
import { FacetBar } from './components/FacetBar'
import { GraphFooter } from './components/GraphFooter'
import { GraphSearch } from './components/GraphSearch'
import { HomeLanding } from './components/HomeLanding'
import {
  KnowledgeGraph,
  type GraphLayoutMode,
  type KnowledgeGraphHandle,
} from './components/KnowledgeGraph'
import { useOntologyStore } from './hooks/useOntologyStore'
import { SPARQL_SOURCES, sourceDisplayName, type SparqlSourceId } from './types/ontology'
import { entityFromHash, hashForEntity } from './utils/entityUrl'

export default function App() {
  const store = useOntologyStore()
  const hasGraph = store.graph.nodes.length > 0
  const isResource = store.config.startMode === 'resource' && hasGraph
  const isHome = !hasGraph && !store.loading
  const [panelCollapsed, setPanelCollapsed] = useState(true)
  const [layoutKey, setLayoutKey] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('hops')
  const [legendVisible, setLegendVisible] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const graphRef = useRef<KnowledgeGraphHandle>(null)
  const bootHash = useRef(false)

  // Deep-link from hash once on mount
  useEffect(() => {
    if (bootHash.current) return
    bootHash.current = true
    const uri = entityFromHash(window.location.hash, store.config.source)
    if (uri) void store.openKnowledgeGraph(uri)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  // Keep hash in sync with open entity
  useEffect(() => {
    if (!isResource || !store.config.seedUri) return
    const next = hashForEntity(store.config.seedUri, store.config.source)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [isResource, store.config.seedUri, store.config.source])

  // New entity / home → keep inspector closed (canvas stays full width)
  useEffect(() => {
    setPanelCollapsed(true)
  }, [store.config.seedUri])

  useEffect(() => {
    if (store.viewMode === 'family') setLayoutMode('family')
    else if (layoutMode === 'family') setLayoutMode('hops')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to viewMode
  }, [store.viewMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (fullscreen) setFullscreen(false)
        else if (!panelCollapsed) setPanelCollapsed(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen, panelCollapsed])

  useEffect(() => {
    const onHash = () => {
      const uri = entityFromHash(window.location.hash, store.config.source)
      if (uri && uri !== store.config.seedUri) void store.openKnowledgeGraph(uri)
      if (!window.location.hash.replace(/^#/, '').trim()) {
        store.clearGraph()
      }
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [store])

  const openPanel = () => {
    if (!fullscreen) setPanelCollapsed(false)
  }

  const onNodeClick = (nodeId: string) => {
    void store.selectNode(nodeId)
    openPanel()
  }

  const onChangeSource = (source: SparqlSourceId) => {
    const endpoint =
      SPARQL_SOURCES.find((s) => s.id === source)?.endpoint ?? store.config.endpoint
    store.clearGraph()
    store.setConfig({
      source,
      endpoint,
      seedUri: '',
      seedLabel: '',
      startMode: 'resource',
    })
    window.history.replaceState(null, '', window.location.pathname)
  }

  const goHome = () => {
    store.clearGraph()
    window.history.replaceState(null, '', window.location.pathname)
    setFullscreen(false)
  }

  if (isHome) {
    return (
      <div className="app-shell home-shell">
        <HomeLanding store={store} onChangeSource={onChangeSource} />
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

  return (
    <div className={`app-shell studio-shell ${fullscreen ? 'canvas-fullscreen' : ''}`}>
      {!fullscreen && (
        <header className="studio-bar">
          <button type="button" className="brand brand-btn" onClick={goHome} title="Back home">
            <span className="brand-mark" aria-hidden />
            <span className="brand-name">Ontara</span>
          </button>

          <div className="studio-search-slot">
            <GraphSearch store={store} variant="compact" />
          </div>

          <div className="source-toggle slim" role="group" aria-label="Knowledge source">
            {SPARQL_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`source-btn ${store.config.source === s.id ? 'active' : ''}`}
                disabled={store.loading}
                onClick={() => onChangeSource(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </header>
      )}

      <main
        className={`workspace ${panelCollapsed || fullscreen ? 'panel-collapsed' : 'panel-open'} ${fullscreen ? 'is-fullscreen' : ''}`}
      >
        <div className="stage-column">
          {isResource && !fullscreen && (
            <FacetBar
              store={store}
              onFamilyLayout={() => {
                setLayoutMode('family')
                setLayoutKey((k) => k + 1)
              }}
            />
          )}

          <section className="canvas-frame">
            {store.loading && !hasGraph && (
              <div className="stage-loading" role="status">
                <span className="stage-loading-pulse" aria-hidden />
                <p>{store.loadingMessage || 'Building graph…'}</p>
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
              onNodeClick={(node) => onNodeClick(node.id)}
              onNodeExpand={(node) => {
                void store.selectNode(node.id)
                openPanel()
                if (
                  node.type === 'literal' ||
                  node.type === 'relation' ||
                  node.id.startsWith('literal:') ||
                  node.id.startsWith('relhub:')
                ) {
                  return
                }
                void store.expandNode('both', { all: true, steps: 1, nodeId: node.id })
              }}
            />
          </section>

          <GraphFooter
            nodeCount={store.graph.nodes.length}
            linkCount={store.graph.links.length}
            sourceLabel={sourceDisplayName(store.config.source)}
            isClassMap={false}
            loading={store.loading}
            loadingMessage={store.loadingMessage}
            lastMessage={store.lastExpandMessage}
            layoutMode={layoutMode}
            legendVisible={legendVisible}
            fullscreen={fullscreen}
            showFamilyLayout={store.viewMode === 'family' || store.entityKind === 'person'}
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
            onHome={goHome}
          />
        </div>

        {!fullscreen && !panelCollapsed && (
          <>
            <button
              type="button"
              className="inspector-backdrop"
              aria-label="Close inspector"
              onClick={() => setPanelCollapsed(true)}
            />
            <ExplorePanel
              store={store}
              collapsed={false}
              onToggleCollapse={() => setPanelCollapsed(true)}
            />
          </>
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
