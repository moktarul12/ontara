import type { GraphLayoutMode } from './KnowledgeGraph'

interface Props {
  nodeCount: number
  linkCount: number
  sourceLabel: string
  isClassMap: boolean
  loading: boolean
  loadingMessage?: string | null
  lastMessage?: string | null
  layoutMode: GraphLayoutMode
  legendVisible: boolean
  fullscreen: boolean
  onLayoutMode: (mode: GraphLayoutMode) => void
  onToggleLegend: () => void
  onToggleFullscreen: () => void
  onAutoArrange: () => void
  onFitView: () => void
}

/** Sticky footer — stats, layout modes, fullscreen, legend. */
export function GraphFooter({
  nodeCount,
  linkCount,
  sourceLabel,
  isClassMap,
  loading,
  loadingMessage,
  lastMessage,
  layoutMode,
  legendVisible,
  fullscreen,
  onLayoutMode,
  onToggleLegend,
  onToggleFullscreen,
  onAutoArrange,
  onFitView,
}: Props) {
  const hasGraph = nodeCount > 0

  return (
    <footer className="graph-footer">
      <div className="footer-stats">
        {hasGraph ? (
          <>
            <span className="stat">
              <em>{nodeCount}</em> nodes
            </span>
            <span className="stat-dot" aria-hidden />
            <span className="stat">
              <em>{linkCount}</em> relations
            </span>
            {isClassMap && (
              <>
                <span className="stat-dot" aria-hidden />
                <span className="stat soft">ontology map</span>
              </>
            )}
            <span className="stat-dot" aria-hidden />
            <span className="stat soft">{sourceLabel}</span>
          </>
        ) : (
          <span className="stat soft">Empty canvas</span>
        )}
        {loading && (
          <>
            <span className="stat-dot" aria-hidden />
            <span className="stat loading">{loadingMessage || 'Loading…'}</span>
          </>
        )}
        {lastMessage && !loading && (
          <>
            <span className="stat-dot" aria-hidden />
            <span className="stat soft footer-msg" title={lastMessage}>
              {lastMessage}
            </span>
          </>
        )}
      </div>

      <div className="footer-actions" role="toolbar" aria-label="Canvas tools">
        <div className="footer-mode-group" role="group" aria-label="Layout view">
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'hops' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('hops')}
            title="Hops view — property clusters"
          >
            Hops
          </button>
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'orbit' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('orbit')}
            title="Orbit view — concentric hop rings"
          >
            Orbit
          </button>
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'auto' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => {
              onLayoutMode('auto')
              onAutoArrange()
            }}
            title="Auto-arrange — organic force layout"
          >
            Auto
          </button>
        </div>

        <button
          type="button"
          className="footer-btn"
          disabled={!hasGraph}
          onClick={onFitView}
          title="Fit graph in view"
        >
          Fit
        </button>
        <button
          type="button"
          className={`footer-btn ${legendVisible ? 'on' : ''}`}
          disabled={!hasGraph}
          onClick={onToggleLegend}
          title={legendVisible ? 'Hide legend' : 'Show legend'}
        >
          {legendVisible ? 'Legend' : 'Legend off'}
        </button>
        <button
          type="button"
          className={`footer-btn accent ${fullscreen ? 'on' : ''}`}
          onClick={onToggleFullscreen}
          title={fullscreen ? 'Exit fullscreen canvas' : 'Fullscreen canvas'}
        >
          {fullscreen ? 'Exit full' : 'Fullscreen'}
        </button>
      </div>
    </footer>
  )
}
