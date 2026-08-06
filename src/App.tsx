import { useEffect, useRef, useState } from 'react'
import { ExplorePanel } from './components/ExplorePanel'
import { GraphFooter } from './components/GraphFooter'
import { HomeLanding } from './components/HomeLanding'
import {
  KnowledgeGraph,
  type GraphLayoutMode,
  type KnowledgeGraphHandle,
} from './components/KnowledgeGraph'
import { StudioHorizon } from './components/StudioHorizon'
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

  useEffect(() => {
    if (bootHash.current) return
    bootHash.current = true
    const uri = entityFromHash(window.location.hash, store.config.source)
    if (uri) void store.openKnowledgeGraph(uri)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, [])

  useEffect(() => {
    if (!isResource || !store.config.seedUri) return
    const next = hashForEntity(store.config.seedUri, store.config.source)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [isResource, store.config.seedUri, store.config.source])

  useEffect(() => {
    if (store.viewMode === 'family') {
      if (layoutMode !== 'family' && layoutMode !== 'family-cascade') {
        setLayoutMode('family')
      }
    } else if (layoutMode === 'family' || layoutMode === 'family-cascade') {
      setLayoutMode('hops')
    }
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

  /** Select → right panel + selection shadow; pull every connection type onto the map. */
  const onNodeClick = (nodeId: string) => {
    openPanel()
    void (async () => {
      await store.selectNode(nodeId)
      if (
        nodeId.startsWith('literal:') ||
        nodeId.startsWith('relhub:') ||
        store.viewMode === 'family' ||
        store.viewMode === 'imdb'
      ) {
        return
      }
      await store.expandNode('both', { all: true, steps: 1, nodeId })
    })()
  }

  // After seed opens, open the right flyout with the root entity.
  useEffect(() => {
    if (!hasGraph || !store.pathRootId || fullscreen) return
    openPanel()
    void store.selectNode(store.pathRootId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open when seed appears
  }, [store.pathRootId])

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
        <StudioHorizon
          store={store}
          onChangeSource={onChangeSource}
          onHome={goHome}
          onFamilyLayout={() => {
            setLayoutMode('family')
            setLayoutKey((k) => k + 1)
          }}
        />
      )}

      <main
        className={`workspace ${panelCollapsed || fullscreen ? 'panel-collapsed' : 'panel-open'} ${fullscreen ? 'is-fullscreen' : ''}`}
      >
        <div className="stage-column">
          <section className="canvas-frame canvas-rise">
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
              onNodeExpand={(node) => onNodeClick(node.id)}
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

        {!fullscreen && (
          <>
            {!panelCollapsed && (
              <button
                type="button"
                className="inspector-backdrop"
                aria-label="Close details"
                onClick={() => setPanelCollapsed(true)}
              />
            )}
            <ExplorePanel
              store={store}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              onFamilyLayout={() => {
                setLayoutMode('family')
                setLayoutKey((k) => k + 1)
              }}
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
