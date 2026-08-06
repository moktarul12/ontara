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
  onExportPng?: () => void
  onExportJpg?: () => void
  onHome?: () => void
  showFamilyLayout?: boolean
}

export function GraphFooter({
  nodeCount,
  linkCount,
  sourceLabel,
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
  onExportPng,
  onHome,
  showFamilyLayout = false,
}: Props) {
  const hasGraph = nodeCount > 0

  return (
    <footer className="graph-footer" aria-label="Canvas toolbar">
      <div className="footer-stats">
        {hasGraph ? (
          <>
            <span className="stat">
              <em>{nodeCount}</em> items
            </span>
            <span className="stat-dot" aria-hidden />
            <span className="stat">
              <em>{linkCount}</em> links
            </span>
            <span className="stat-dot" aria-hidden />
            <span className="stat soft">{sourceLabel}</span>
          </>
        ) : (
          <span className="stat soft">Opening map…</span>
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

      <div className="footer-actions" role="toolbar" aria-label="Map tools">
        {onHome && (
          <button type="button" className="footer-btn" onClick={onHome} title="New search">
            Home
          </button>
        )}
        <div className="footer-mode-group" role="group" aria-label="Layout">
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'hops' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('hops')}
            title="Arrange by distance from focus"
          >
            Distance
          </button>
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'orbit' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('orbit')}
            title="Circular layout"
          >
            Orbit
          </button>
          {showFamilyLayout && (
            <>
              <button
                type="button"
                className={`footer-btn ${layoutMode === 'family' ? 'on' : ''}`}
                disabled={!hasGraph}
                onClick={() => onLayoutMode('family')}
                title="Pedigree rows — generations left to right"
              >
                Pedigree
              </button>
              <button
                type="button"
                className={`footer-btn ${layoutMode === 'family-cascade' ? 'on' : ''}`}
                disabled={!hasGraph}
                onClick={() => onLayoutMode('family-cascade')}
                title="Cascade — children nest under parents"
              >
                Cascade
              </button>
            </>
          )}
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'auto' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => {
              onLayoutMode('auto')
              onAutoArrange()
            }}
            title="Auto-arrange for readability"
          >
            Arrange
          </button>
        </div>

        <button type="button" className="footer-btn" disabled={!hasGraph} onClick={onFitView}>
          Fit view
        </button>
        <button
          type="button"
          className="footer-btn"
          disabled={!hasGraph || !onExportPng}
          onClick={() => onExportPng?.()}
        >
          Save PNG
        </button>
        <button
          type="button"
          className={`footer-btn ${legendVisible ? 'on' : ''}`}
          disabled={!hasGraph}
          onClick={onToggleLegend}
        >
          Guide
        </button>
        <button
          type="button"
          className={`footer-btn accent ${fullscreen ? 'on' : ''}`}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? 'Exit full' : 'Fullscreen'}
        </button>
      </div>
    </footer>
  )
}
