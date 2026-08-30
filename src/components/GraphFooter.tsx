import { useEffect, useRef, useState } from 'react'
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
  onExportJpg,
  onHome,
  showFamilyLayout = false,
}: Props) {
  const hasGraph = nodeCount > 0
  const [downloadOpen, setDownloadOpen] = useState(false)
  const downloadRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!downloadOpen) return
    const onDoc = (e: MouseEvent) => {
      if (!downloadRef.current?.contains(e.target as Node)) setDownloadOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDownloadOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [downloadOpen])

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
          {showFamilyLayout && (
            <button
              type="button"
              className={`footer-btn ${layoutMode === 'family-tree' || layoutMode === 'family' || layoutMode === 'family-cascade' ? 'on' : ''}`}
              disabled={!hasGraph}
              onClick={() => onLayoutMode('family-tree')}
              title="Family tree — rearrange as pedigree"
            >
              Family tree
            </button>
          )}
        </div>

        <button type="button" className="footer-btn" disabled={!hasGraph} onClick={onFitView}>
          Fit view
        </button>

        <div className="footer-download" ref={downloadRef}>
          <button
            type="button"
            className={`footer-btn footer-download-btn ${downloadOpen ? 'on' : ''}`}
            disabled={!hasGraph || (!onExportPng && !onExportJpg)}
            aria-haspopup="menu"
            aria-expanded={downloadOpen}
            title="Download the graph as an image"
            onClick={() => setDownloadOpen((o) => !o)}
          >
            Download image
          </button>
          {downloadOpen && (
            <div className="footer-download-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                className="footer-download-item"
                disabled={!onExportPng}
                onClick={() => {
                  setDownloadOpen(false)
                  onExportPng?.()
                }}
              >
                PNG — crisp
              </button>
              <button
                type="button"
                role="menuitem"
                className="footer-download-item"
                disabled={!onExportJpg}
                onClick={() => {
                  setDownloadOpen(false)
                  onExportJpg?.()
                }}
              >
                JPG — smaller
              </button>
            </div>
          )}
        </div>

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
