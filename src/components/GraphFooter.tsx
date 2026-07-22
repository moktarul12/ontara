interface Props {
  nodeCount: number
  linkCount: number
  sourceLabel: string
  isClassMap: boolean
  loading: boolean
  loadingMessage?: string | null
  lastMessage?: string | null
  onResetLayout: () => void
  onFitView: () => void
}

/** Sticky footer under the canvas — stats + camera. */
export function GraphFooter({
  nodeCount,
  linkCount,
  sourceLabel,
  isClassMap,
  loading,
  loadingMessage,
  lastMessage,
  onResetLayout,
  onFitView,
}: Props) {
  return (
    <footer className="graph-footer">
      <div className="footer-stats">
        {nodeCount > 0 ? (
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
      <div className="footer-actions">
        <button type="button" className="footer-btn" onClick={onFitView} disabled={!nodeCount}>
          Fit
        </button>
        <button
          type="button"
          className="footer-btn accent"
          onClick={onResetLayout}
          disabled={!nodeCount}
        >
          Reset layout
        </button>
      </div>
    </footer>
  )
}
