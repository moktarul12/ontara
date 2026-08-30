import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasToolbar } from './components/CanvasToolbar'
import { CompareView, type ComparePin, MAX_COMPARE } from './components/CompareView'
import { EntityHeader, type EntityTab } from './components/EntityHeader'
import { GuidedJourneys, type JourneyLaunchOptions } from './components/GuidedJourneys'
import { HopPathTrail } from './components/HopPathTrail'
import { InsightPanel } from './components/InsightPanel'
import {
  KnowledgeGraph,
  isFamilyLayout,
  type GraphLayoutMode,
  type KnowledgeGraphHandle,
} from './components/KnowledgeGraph'
import { LensView } from './components/LensView'
import { NodeFocusModal } from './components/NodeFocusModal'
import { OverviewView } from './components/OverviewView'
import { SearchRail } from './components/SearchRail'
import { useOntologyStore } from './hooks/useOntologyStore'
import { MAX_ONTOLOGY_HOPS } from './services/ontologyHops'
import {
  SPARQL_SOURCES,
  sourceDisplayName,
  type SparqlSourceId,
} from './types/ontology'
import {
  downloadBlob,
  exportEdgesCsv,
  exportGraphJson,
  exportNodesCsv,
} from './utils/graphExport'
import { serializeGraphSnapshot } from './utils/graphSnapshot'
import { entityFromHash, entityUrisMatch, canonicalEntityUri, hashForEntity, hashForMapSnapshot, parseHash } from './utils/entityUrl'
import { kindOf } from './utils/nodeKind'
import { loadSettings, loadGraphSnapshot, pushHistory, saveGraphSnapshot, saveSettings } from './utils/workspace'

export default function App() {
  const store = useOntologyStore()
  const hasGraph = store.graph.nodes.length > 0
  const isResource = store.config.startMode === 'resource' && hasGraph
  const [entityTab, setEntityTab] = useState<EntityTab>('graph')
  const [layoutKey, setLayoutKey] = useState(0)
  const [fitKey, setFitKey] = useState(0)
  const [layoutMode, setLayoutMode] = useState<GraphLayoutMode>('auto')
  const [fullscreen, setFullscreen] = useState(false)
  const [depth, setDepth] = useState(() => loadSettings().defaultDepth)
  const [contentLanguage, setContentLanguage] = useState(() => loadSettings().contentLanguage)
  const [railCollapsed, setRailCollapsed] = useState(false)
  const [insightCollapsed, setInsightCollapsed] = useState(false)
  const [headerCollapsed, setHeaderCollapsed] = useState(false)
  const [searchBusy, setSearchBusy] = useState(false)
  const [comparePins, setComparePins] = useState<ComparePin[]>([])
  const [focusModalId, setFocusModalId] = useState<string | null>(null)
  const [pathTargetHint, setPathTargetHint] = useState<{ label: string; uri: string } | null>(
    null,
  )
  const [relatedChips, setRelatedChips] = useState<{ label: string; uri: string }[]>([])
  const graphRef = useRef<KnowledgeGraphHandle>(null)
  const bootHash = useRef(false)
  const pendingJourney = useRef<JourneyLaunchOptions | null>(null)
  const canvasBusy = store.loading || searchBusy
  const busyMessage = store.loading
    ? store.loadingMessage || 'Building graph…'
    : searchBusy
      ? 'Searching the knowledge graph…'
      : ''

  const focusModalNode = focusModalId
    ? store.graph.nodes.find((n) => n.id === focusModalId) ?? null
    : null

  useEffect(() => {
    if (bootHash.current) return
    bootHash.current = true
    const parsed = parseHash(window.location.hash, store.config.source)
    if (parsed?.type === 'map') {
      const snap = loadGraphSnapshot(parsed.snapshotId)
      if (snap) {
        store.restoreGraphSnapshot(snap)
        setEntityTab('graph')
        return
      }
    }
    if (parsed?.type === 'entity') {
      void store.openKnowledgeGraph(parsed.uri)
    } else {
      const uri = entityFromHash(window.location.hash, store.config.source)
      if (uri) void store.openKnowledgeGraph(uri)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isResource || !store.config.seedUri) return
    if (window.location.hash.includes('/map/')) return
    const next = hashForEntity(store.config.seedUri, store.config.source)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [isResource, store.config.seedUri, store.config.source])

  useEffect(() => {
    if (!store.pathRootId || !store.config.seedLabel) return
    pushHistory({
      uri: store.pathRootId,
      label: store.config.seedLabel,
      source: store.config.source,
    })
  }, [store.pathRootId, store.config.seedLabel, store.config.source])

  useEffect(() => {
    if (store.viewMode === 'family') {
      setEntityTab('family')
      if (!isFamilyLayout(layoutMode)) setLayoutMode('family-tree')
    } else if (store.viewMode === 'imdb') {
      setEntityTab('movie')
    } else if (isFamilyLayout(layoutMode)) {
      // Left family layout — reflow only, keep current tab
      setLayoutMode('auto')
      setLayoutKey((k) => k + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.viewMode])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHash(window.location.hash, store.config.source)
      if (parsed?.type === 'map') {
        const snap = loadGraphSnapshot(parsed.snapshotId)
        if (snap) store.restoreGraphSnapshot(snap)
        return
      }
      const uri = entityFromHash(window.location.hash, store.config.source)
      if (uri && uri !== store.config.seedUri) void store.openKnowledgeGraph(uri)
      if (!window.location.hash.replace(/^#/, '').trim()) store.clearGraph()
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [store])

  useEffect(() => {
    if (!hasGraph || !store.pathRootId || fullscreen) return
    void store.selectNode(store.pathRootId)
    setRailCollapsed(true)

    const journey = pendingJourney.current
    if (journey) {
      pendingJourney.current = null
      setEntityTab(journey.defaultTab ?? 'graph')
      if (journey.journey.relatedChips) setRelatedChips(journey.journey.relatedChips)
      if (journey.postOpen === 'applyHops2') void store.applyHops(2, 'both')
      if (journey.postOpen === 'pathMode') {
        store.startPathMode(store.pathRootId ?? undefined)
        if (journey.journey.pathTargetUri && journey.journey.pathTargetLabel) {
          setPathTargetHint({
            uri: journey.journey.pathTargetUri,
            label: journey.journey.pathTargetLabel,
          })
        }
      }
    } else {
      // Hash URLs and search opens land on the graph canvas first (keep Compare tab)
      setEntityTab((tab) => (tab === 'compare' ? tab : 'graph'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setRailCollapsed(false)
    setRelatedChips([])
    setComparePins([])
  }

  const goHome = () => {
    store.clearGraph()
    window.history.replaceState(null, '', window.location.pathname)
    setFullscreen(false)
    setEntityTab('graph')
    setRailCollapsed(false)
    setRelatedChips([])
    setComparePins([])
    setPathTargetHint(null)
  }

  const launchJourney = useCallback((opts: JourneyLaunchOptions) => {
    const j = opts.journey
    pendingJourney.current = opts
    setRelatedChips(j.relatedChips ?? [])
    setPathTargetHint(
      j.pathTargetUri && j.pathTargetLabel
        ? { uri: j.pathTargetUri, label: j.pathTargetLabel }
        : null,
    )
    if (j.source !== store.config.source) {
      const endpoint = SPARQL_SOURCES.find((s) => s.id === j.source)?.endpoint
      if (endpoint) store.setConfig({ source: j.source, endpoint })
    }
    setRailCollapsed(false)
    void store.openKnowledgeGraph(j.seedUri)
  }, [store])

  const onPathTarget = useCallback(
    (uri: string) => {
      store.findPathTo(uri)
    },
    [store],
  )

  const onContentLanguageChange = useCallback((lang: string) => {
    setContentLanguage(lang)
    saveSettings({ ...loadSettings(), contentLanguage: lang })
  }, [])

  const addToCompare = useCallback((uri: string, label: string) => {
    const canon = canonicalEntityUri(uri, store.config.source)
    setComparePins((prev) => {
      if (prev.some((p) => entityUrisMatch(p.uri, canon))) {
        return prev.filter((p) => !entityUrisMatch(p.uri, canon))
      }
      const next =
        prev.length >= MAX_COMPARE
          ? [...prev.slice(1), { uri: canon, label }]
          : [...prev, { uri: canon, label }]
      if (next.length >= 2) setEntityTab('compare')
      return next
    })
  }, [store.config.source])

  /** Add-only pin (Compare tab search) — never toggles off an existing pin. */
  const pinToCompare = useCallback((uri: string, label: string) => {
    const canon = canonicalEntityUri(uri, store.config.source)
    setComparePins((prev) => {
      if (prev.some((p) => entityUrisMatch(p.uri, canon))) return prev
      const next =
        prev.length >= MAX_COMPARE
          ? [...prev.slice(1), { uri: canon, label }]
          : [...prev, { uri: canon, label }]
      if (next.length >= 2) setEntityTab('compare')
      return next
    })
  }, [store.config.source])

  const removeFromCompare = useCallback((uri: string) => {
    setComparePins((prev) => prev.filter((p) => !entityUrisMatch(p.uri, uri)))
  }, [])

  const saveMap = useCallback(() => {
    if (!store.config.seedUri) return
    const snap = serializeGraphSnapshot({
      source: store.config.source,
      seedUri: store.config.seedUri,
      seedLabel: store.config.seedLabel,
      entityKind: store.entityKind,
      appliedHopDepth: store.appliedHopDepth,
      expandedFacets: store.expandedFacets,
      selectedNodeId: store.selectedNodeId,
      graph: store.graph,
    })
    const id = saveGraphSnapshot(snap)
    const hash = hashForMapSnapshot(id)
    window.history.replaceState(null, '', hash)
    store.clearExpandMessage()
    void navigator.clipboard?.writeText(`${window.location.origin}${window.location.pathname}${hash}`)
  }, [store])

  const copyShareLink = saveMap

  const exportJson = useCallback(() => {
    const json = exportGraphJson(store.graph, {
      seedUri: store.config.seedUri,
      seedLabel: store.config.seedLabel,
      source: store.config.source,
    })
    const slug = (store.config.seedLabel || 'graph').replace(/\s+/g, '-').slice(0, 24)
    downloadBlob(`${slug}.json`, json, 'application/json')
  }, [store])

  const exportCsv = useCallback(() => {
    const slug = (store.config.seedLabel || 'graph').replace(/\s+/g, '-').slice(0, 24)
    const nodes = exportNodesCsv(store.graph)
    const edges = exportEdgesCsv(store.graph)
    downloadBlob(`${slug}-nodes.csv`, nodes, 'text/csv')
    downloadBlob(`${slug}-edges.csv`, edges, 'text/csv')
  }, [store])

  const onNodeClick = (nodeId: string) => {
    if (store.pathMode === 'pickTarget') {
      onPathTarget(nodeId)
      return
    }
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
      setFocusModalId(nodeId)
    })()
  }

  const applyDepth = (n: number) => {
    const d = Math.max(1, Math.min(MAX_ONTOLOGY_HOPS, n))
    setDepth(d)
    void store.applyHops(d, 'both')
  }

  const familyLayout = () => {
    setLayoutMode('family-tree')
    setLayoutKey((k) => k + 1)
  }

  const onOverviewLens = useCallback(
    (tab: EntityTab) => {
      if (tab === 'graph') {
        if (store.viewMode === 'family') void store.exitFamilyTree()
        else if (store.viewMode === 'imdb') void store.exitImdbView()
        setEntityTab('graph')
        setLayoutMode('auto')
        return
      }
      if (tab === 'family') {
        setEntityTab('family')
        void store.openFamilyTree(store.familyDepth).then(familyLayout)
        return
      }
      if (tab === 'movie') {
        setEntityTab('movie')
        void store.openImdbView()
        setLayoutMode('auto')
        setLayoutKey((k) => k + 1)
        return
      }
      if (tab === 'timeline') {
        setEntityTab('overview')
        const uri = store.pathRootId || store.config.seedUri
        if (uri) {
          const hash = hashForEntity(uri, store.config.source, 'timeline')
          if (window.location.hash !== hash) {
            window.history.replaceState(null, '', hash)
            window.dispatchEvent(new HashChangeEvent('hashchange'))
          }
        }
        return
      }
      setEntityTab(tab)
    },
    [store],
  )

  const showGraphLens =
    entityTab === 'graph' || entityTab === 'family' || entityTab === 'movie'
  const showAltLens =
    entityTab === 'business' ||
    entityTab === 'music' ||
    entityTab === 'places' ||
    entityTab === 'timeline' ||
    entityTab === 'table' ||
    entityTab === 'compare'

  const shellClass = [
    'kg-shell',
    fullscreen ? 'is-fullscreen' : '',
    entityTab === 'overview' ? 'overview-mode' : '',
    !fullscreen && railCollapsed ? 'rail-collapsed' : '',
    !fullscreen && insightCollapsed ? 'insight-collapsed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      {!fullscreen && (
        <SearchRail
          store={store}
          onChangeSource={onChangeSource}
          onHome={goHome}
          focusSearch={!hasGraph || !railCollapsed}
          collapsed={railCollapsed}
          onToggleCollapse={() => setRailCollapsed((v) => !v)}
          onEntityOpened={() => setRailCollapsed(true)}
          onBusyChange={setSearchBusy}
          onLaunchJourney={launchJourney}
          onPathTarget={onPathTarget}
          pathTargetHint={pathTargetHint ?? undefined}
          showJourneys={!hasGraph}
        />
      )}

      <div className="kg-main">
        {hasGraph ? (
          <>
            {!fullscreen && (
              <>
                <EntityHeader
                  store={store}
                  activeTab={entityTab}
                  onTab={setEntityTab}
                  onFamily={() => {
                    void store.openFamilyTree(store.familyDepth).then(familyLayout)
                  }}
                  onMovie={() => {
                    void store.openImdbView()
                    setLayoutMode('auto')
                    setLayoutKey((k) => k + 1)
                  }}
                  onGraph={() => {
                    if (store.viewMode === 'family') void store.exitFamilyTree()
                    else if (store.viewMode === 'imdb') void store.exitImdbView()
                    setLayoutMode('auto')
                  }}
                  headerCollapsed={headerCollapsed}
                  onToggleHeader={() => setHeaderCollapsed((v) => !v)}
                  hideLensTabs={entityTab === 'overview'}
                />
                {relatedChips.length > 0 && (
                  <div className="related-chips-bar">
                    <span>Related:</span>
                    {relatedChips.map((c) => (
                      <button
                        key={c.uri}
                        type="button"
                        className="phase-chip"
                        onClick={() => void store.openKnowledgeGraph(c.uri)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <section className={`kg-canvas-wrap ${canvasBusy ? 'is-busy' : ''}`}>
              {store.pathSteps.length > 1 && (
                <HopPathTrail
                  steps={store.pathSteps}
                  rootLabel={store.config.seedLabel}
                  onClear={store.clearPath}
                  onStepClick={(id) => void store.selectNode(id)}
                />
              )}
              {canvasBusy && (
                <div className="kg-canvas-veil" role="status" aria-live="polite">
                  <div className="kg-canvas-veil-rings" aria-hidden>
                    <span />
                    <span />
                    <span />
                  </div>
                  <p className="kg-canvas-veil-msg">{busyMessage || 'Working…'}</p>
                </div>
              )}
              {entityTab === 'overview' && (
                <OverviewView
                  store={store}
                  contentLanguage={contentLanguage}
                  onContentLanguageChange={onContentLanguageChange}
                  onOpenGraph={() => setEntityTab('graph')}
                  onLens={onOverviewLens}
                />
              )}
              {entityTab === 'evidence' && (
                <div className="kg-overview-card">
                  <h2>Evidence</h2>
                  <p>Live facts from {sourceDisplayName(store.config.source)}.</p>
                  {store.pathRootId && (
                    <a
                      className="eh-btn primary"
                      href={store.pathRootId}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source entity
                    </a>
                  )}
                </div>
              )}
              {entityTab === 'compare' && (
                <CompareView
                  store={store}
                  comparePins={comparePins}
                  onOpen={(uri) => void store.openKnowledgeGraph(uri)}
                  onRemove={removeFromCompare}
                  onClear={() => setComparePins([])}
                />
              )}
              {showAltLens && entityTab !== 'compare' && (
                <LensView
                  store={store}
                  tab={entityTab}
                  onSelect={(id) => void store.selectNode(id)}
                  onOpen={(uri) => void store.openKnowledgeGraph(uri)}
                />
              )}
              {showGraphLens && (
                <>
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
                    showLegend={false}
                    onNodeClick={(node) => onNodeClick(node.id)}
                    onNodeExpand={(node) => onNodeClick(node.id)}
                    onExpandFamily={(node) => {
                      void store.expandFamilyTree(node.id).then(familyLayout)
                    }}
                  />
                  <CanvasToolbar
                    layoutMode={layoutMode}
                    fullscreen={fullscreen}
                    depth={store.viewMode === 'family' ? store.familyDepth : depth}
                    maxDepth={store.viewMode === 'family' ? 5 : MAX_ONTOLOGY_HOPS}
                    familyMode={store.viewMode === 'family'}
                    canFamilyTree={(() => {
                      if (store.entityKind === 'person' || store.viewMode === 'family')
                        return true
                      const root =
                        store.graph.nodes.find((n) => n.id === store.pathRootId) ||
                        store.selectedNode
                      return root ? kindOf(root) === 'person' : false
                    })()}
                    depthDisabled={store.loading || !store.pathRootId}
                    onDepth={(n) => {
                      if (store.viewMode === 'family') {
                        store.setFamilyDepth(n)
                        void store.openFamilyTree(n).then(familyLayout)
                        return
                      }
                      applyDepth(n)
                    }}
                    onLayoutMode={(m) => {
                      setLayoutMode(m)
                      setLayoutKey((k) => k + 1)
                    }}
                    onFamilyTree={() => {
                      if (store.viewMode === 'family') {
                        familyLayout()
                        return
                      }
                      void store.openFamilyTree(store.familyDepth).then(() => familyLayout())
                    }}
                    onFit={() => setFitKey((k) => k + 1)}
                    onExportPng={() => void graphRef.current?.exportImage('png')}
                    onExportJson={exportJson}
                    onExportCsv={exportCsv}
                    onSaveMap={saveMap}
                    onToggleFullscreen={() => {
                      setFullscreen((v) => {
                        const next = !v
                        if (next) window.setTimeout(() => setFitKey((k) => k + 1), 80)
                        return next
                      })
                    }}
                  />
                  {focusModalNode && (
                    <NodeFocusModal
                      node={focusModalNode}
                      graph={store.graph}
                      rootId={store.pathRootId}
                      rootLabel={store.config.seedLabel || 'focus'}
                      dataProperties={store.dataProperties}
                      onClose={() => setFocusModalId(null)}
                      onExpand={() => {
                        const id = focusModalNode.id
                        setFocusModalId(null)
                        void store.expandNode('both', { all: true, steps: 1, nodeId: id })
                      }}
                      onOpenFocus={() => {
                        setFocusModalId(null)
                        void store.openKnowledgeGraph(focusModalNode.id)
                      }}
                      onFamilyTree={
                        kindOf(focusModalNode) === 'person'
                          ? () => {
                              setFocusModalId(null)
                              void store.expandFamilyTree(focusModalNode.id).then(familyLayout)
                            }
                          : undefined
                      }
                    />
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          <section className={`kg-empty ${canvasBusy ? 'is-busy' : ''}`}>
            {canvasBusy ? (
              <div className="kg-canvas-veil static" role="status" aria-live="polite">
                <div className="kg-canvas-veil-rings" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <p className="kg-canvas-veil-msg">{busyMessage || 'Opening entity…'}</p>
              </div>
            ) : (
              <>
                <h1>Explore the knowledge graph</h1>
                <p>
                  Pick a guided journey or search any person, film, company, or place.
                </p>
                <GuidedJourneys onLaunch={launchJourney} />
              </>
            )}
          </section>
        )}
      </div>

      {!fullscreen && hasGraph && entityTab !== 'overview' && (
        <InsightPanel
          store={store}
          entityTab={entityTab}
          comparePins={comparePins}
          onPinToCompare={pinToCompare}
          onRemoveFromCompare={removeFromCompare}
          onClearCompare={() => setComparePins([])}
          onSelectNode={(id) => void store.selectNode(id)}
          onExpandFamily={() => {
            const id = store.selectedNodeId || store.pathRootId
            if (!id) return
            void store.expandFamilyTree(id).then(familyLayout)
          }}
          collapsed={insightCollapsed}
          onToggleCollapse={() => setInsightCollapsed((v) => !v)}
          onStartPathMode={() => store.startPathMode(store.pathRootId ?? undefined)}
          onClearPathMode={() => store.clearPathMode()}
          onAddToCompare={addToCompare}
          onSaveMap={saveMap}
          onCopyShareLink={copyShareLink}
          compareUris={comparePins.map((p) => p.uri)}
          compareCount={comparePins.length}
          compareMax={MAX_COMPARE}
          onFacetExpanded={() => {
            setEntityTab((tab) =>
              tab === 'graph' ||
              tab === 'family' ||
              tab === 'movie' ||
              tab === 'overview' ||
              tab === 'compare'
                ? tab
                : 'graph',
            )
            setLayoutKey((k) => k + 1)
            setFitKey((k) => k + 1)
          }}
        />
      )}

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
