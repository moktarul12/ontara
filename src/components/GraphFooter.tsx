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
  /** Show Family pedigree layout button (person / family view). */
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
    <footer className="graph-footer">
      <div className="footer-stats">
        {hasGraph ? (
          <>
            <span className="stat">
              <em>{nodeCount}</em> nodes
            </span>
            <span className="stat-dot" aria-hidden />
            <span className="stat">
              <em>{linkCount}</em> links
            </span>
            <span className="stat-dot" aria-hidden />
            <span className="stat soft">{sourceLabel}</span>
          </>
        ) : (
          <span className="stat soft">Opening graph…</span>
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
        {onHome && (
          <button type="button" className="footer-btn" onClick={onHome} title="New search">
            Home
          </button>
        )}
        <div className="footer-mode-group" role="group" aria-label="Layout view">
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'hops' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('hops')}
            title="Hops view"
          >
            Hops
          </button>
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'orbit' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => onLayoutMode('orbit')}
            title="Orbit view"
          >
            Orbit
          </button>
          {showFamilyLayout && (
            <button
              type="button"
              className={`footer-btn ${layoutMode === 'family' ? 'on' : ''}`}
              disabled={!hasGraph}
              onClick={() => onLayoutMode('family')}
              title="Family pedigree layout"
            >
              Family
            </button>
          )}
          <button
            type="button"
            className={`footer-btn ${layoutMode === 'auto' ? 'on' : ''}`}
            disabled={!hasGraph}
            onClick={() => {
              onLayoutMode('auto')
              onAutoArrange()
            }}
            title="Auto-arrange"
          >
            Auto
          </button>
        </div>

        <button type="button" className="footer-btn" disabled={!hasGraph} onClick={onFitView}>
          Fit
        </button>
        <button
          type="button"
          className="footer-btn"
          disabled={!hasGraph || !onExportPng}
          onClick={() => onExportPng?.()}
        >
          PNG
        </button>
        <button
          type="button"
          className={`footer-btn ${legendVisible ? 'on' : ''}`}
          disabled={!hasGraph}
          onClick={onToggleLegend}
        >
          Legend
        </button>
        <button
          type="button"
          className={`footer-btn accent ${fullscreen ? 'on' : ''}`}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? 'Exit' : 'Full'}
        </button>
      </div>
    </footer>
  )
}
