import { isFamilyLayout, type GraphLayoutMode } from './KnowledgeGraph'

interface Props {
  layoutMode: GraphLayoutMode
  fullscreen: boolean
  depth: number
  maxDepth?: number
  /** Enable family-tree rearrange (person entities). */
  canFamilyTree?: boolean
  familyMode?: boolean
  onLayoutMode: (mode: GraphLayoutMode) => void
  /** Rearrange canvas into family-tree view. */
  onFamilyTree: () => void
  onFit: () => void
  onExportPng: () => void
  onExportJson?: () => void
  onExportCsv?: () => void
  onSaveMap?: () => void
  onToggleFullscreen: () => void
  onDepth: (n: number) => void
  depthDisabled?: boolean
}

/** Auto-arrange — force-style reflow (not orbit) */
function IconArrange() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M4 7h6M14 7h6M4 12h16M4 17h6M14 17h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M9 5.5 11 7 9 8.5M15 15.5 13 17l2 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Family tree — branching kinship */
function IconFamilyTree() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 21v-5.5M12 15.5 6.5 10M12 15.5 17.5 10M6.5 10 4 6.5M6.5 10l3.2-3.8M17.5 10 20 6.5M17.5 10l-3.2-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="21" r="1.55" fill="currentColor" />
      <circle cx="6.5" cy="10" r="1.35" fill="currentColor" />
      <circle cx="17.5" cy="10" r="1.35" fill="currentColor" />
      <circle cx="4" cy="6.5" r="1.15" fill="currentColor" />
      <circle cx="9.7" cy="6.2" r="1.15" fill="currentColor" />
      <circle cx="14.3" cy="6.2" r="1.15" fill="currentColor" />
      <circle cx="20" cy="6.5" r="1.15" fill="currentColor" />
    </svg>
  )
}

function IconDownload() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M12 3.5v10.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M8.2 10.2 12 14l3.8-3.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 17.5h13"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M6.5 20.2h11"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconFit() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M3.5 8.5V3.5H8.5M15.5 3.5h5v5M20.5 15.5v5h-5M8.5 20.5h-5v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconFull() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M14.5 3.5H20.5V9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 20.5H3.5V14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20.5 3.5 13.5 10.5M3.5 20.5 10.5 13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconExitFull() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        d="M20.5 9.5V3.5H14.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 14.5v6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.5 9.5 20.5 3.5M9.5 14.5 3.5 20.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CanvasToolbar({
  layoutMode,
  fullscreen,
  depth,
  maxDepth = 5,
  canFamilyTree = true,
  familyMode = false,
  onLayoutMode,
  onFamilyTree,
  onFit,
  onExportPng,
  onExportJson,
  onExportCsv,
  onSaveMap,
  onToggleFullscreen,
  onDepth,
  depthDisabled,
}: Props) {
  const inFamily = familyMode || isFamilyLayout(layoutMode)

  return (
    <div className="canvas-overlays" aria-hidden={false}>
      <div className="canvas-legend" aria-label="Node kinds">
        {inFamily ? (
          <>
            <span>
              <i className="lg person" /> Relatives
            </span>
            <span>
              <i className="lg kin" /> Kinship
            </span>
            <span>
              <i className="lg place" /> Focus
            </span>
          </>
        ) : (
          <>
            <span>
              <i className="lg person" /> People
            </span>
            <span>
              <i className="lg org" /> Org
            </span>
            <span>
              <i className="lg work" /> Work
            </span>
            <span>
              <i className="lg place" /> Place
            </span>
          </>
        )}
      </div>

      <div className="canvas-depth" role="group" aria-label="Graph depth">
        <button
          type="button"
          className="canvas-depth-btn"
          title="Decrease depth"
          disabled={depthDisabled || depth <= 1}
          onClick={() => onDepth(depth - 1)}
        >
          −
        </button>
        <span className="canvas-depth-val" title="Current hop depth">
          {depth}
        </span>
        <button
          type="button"
          className="canvas-depth-btn"
          title="Increase depth"
          disabled={depthDisabled || depth >= maxDepth}
          onClick={() => onDepth(depth + 1)}
        >
          +
        </button>
      </div>

      <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
        <button
          type="button"
          className={`canvas-tool ${!inFamily && layoutMode === 'auto' ? 'on' : ''}`}
          title={inFamily ? 'Re-arrange family tree' : 'Auto arrange'}
          onClick={() => {
            // In family mode, Arrange must re-run the pedigree — never cose/force layout
            if (inFamily) onFamilyTree()
            else onLayoutMode('auto')
          }}
        >
          <IconArrange />
          <span className="canvas-tool-tip">Arrange</span>
        </button>

        <button
          type="button"
          className={`canvas-tool ${isFamilyLayout(layoutMode) ? 'on' : ''}`}
          title="Family tree view — rearrange as pedigree"
          disabled={!canFamilyTree}
          onClick={onFamilyTree}
        >
          <IconFamilyTree />
          <span className="canvas-tool-tip">Family tree</span>
        </button>

        <span className="canvas-tool-sep" aria-hidden />

        <button type="button" className="canvas-tool" title="Download PNG" onClick={onExportPng}>
          <IconDownload />
          <span className="canvas-tool-tip">PNG</span>
        </button>
        {onExportJson && (
          <button type="button" className="canvas-tool" title="Export JSON" onClick={onExportJson}>
            <span className="canvas-tool-text">JSON</span>
          </button>
        )}
        {onExportCsv && (
          <button type="button" className="canvas-tool" title="Export CSV" onClick={onExportCsv}>
            <span className="canvas-tool-text">CSV</span>
          </button>
        )}
        {onSaveMap && (
          <button type="button" className="canvas-tool" title="Save map" onClick={onSaveMap}>
            <span className="canvas-tool-text">Save</span>
          </button>
        )}
        <button type="button" className="canvas-tool" title="Fit view" onClick={onFit}>
          <IconFit />
          <span className="canvas-tool-tip">Fit</span>
        </button>
        <button
          type="button"
          className={`canvas-tool ${fullscreen ? 'on' : ''}`}
          title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <IconExitFull /> : <IconFull />}
          <span className="canvas-tool-tip">{fullscreen ? 'Exit' : 'Full'}</span>
        </button>
      </div>
    </div>
  )
}
