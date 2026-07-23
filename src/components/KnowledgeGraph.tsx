import { useEffect, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import type { GraphData, GraphLink, GraphNode } from '../types/ontology'
import { hopStyle, kindOf, labelBoxSize, ontologyNodeColors, HOP_RADIUS } from '../utils/nodeKind'
import { graphHasOntologyHubs } from '../utils/treeLayout'
import { GraphLegend } from './GraphLegend'

cytoscape.use(coseBilkent)

export type GraphLayoutMode = 'hops' | 'orbit' | 'auto'

interface Props {
  data: GraphData
  selectedNodeId: string | null
  highlightedLinkId: string | null
  graphEpoch?: number
  layoutKey?: number
  fitKey?: number
  pathNodeIds?: string[]
  pathLinkIds?: string[]
  layoutMode?: GraphLayoutMode
  showLegend?: boolean
  onNodeClick: (node: GraphNode) => void
  /** Double-click an entity to load everything attached (next hop, full). */
  onNodeExpand?: (node: GraphNode) => void
  onBackgroundClick?: () => void
}

function shortLabel(label: string, max = 22) {
  const t = label.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function linkEnds(l: GraphLink): { source: string; target: string } {
  const source = typeof l.source === 'string' ? l.source : l.source.id
  const target = typeof l.target === 'string' ? l.target : l.target.id
  return { source, target }
}

function buildElements(data: GraphData): ElementDefinition[] {
  const hopOf = new Map(data.nodes.map((n) => [n.id, n.__hopDepth ?? 0]))
  const rootId =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id

  const nodes: ElementDefinition[] = data.nodes.map((n) => {
    const kind = kindOf(n)
    const hop = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const colors = ontologyNodeColors(n)
    const isRoot = n.id === rootId
    const box = labelBoxSize(n.label, {
      root: isRoot,
      literal: n.type === 'literal',
      relation: n.type === 'relation',
    })
    const width = box.width
    const height = box.height

    return {
      group: 'nodes',
      data: {
        id: n.id,
        label: box.label,
        fullLabel: n.label,
        kind,
        hopDepth: hop,
        hopBadge:
          hop === 0
            ? 'ENTITY'
            : n.type === 'relation'
              ? `P${hop}`
              : `H${hop}`,
        nodeType: n.type,
        uri: n.uri,
        boxW: width,
        boxH: height,
        textMax: box.textMax,
        clusterKey: n.__clusterKey ?? '',
        parentId: n.__parentId ?? '',
        fill: colors.fill,
        border: colors.border,
        textColor: colors.text,
      },
      classes: [
        `hop-${hop}`,
        n.type === 'literal' ? 'is-literal' : '',
        n.type === 'relation' ? 'is-relation' : '',
        isRoot ? 'is-root' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        width,
        height,
        'background-color': colors.fill,
        'border-color': colors.border,
        color: colors.text,
        shape: isRoot ? 'ellipse' : 'round-rectangle',
        'text-max-width': box.textMax,
      },
    }
  })

  const links: ElementDefinition[] = data.links.map((l) => {
    const { source, target } = linkEnds(l)
    const hs = hopOf.get(source) ?? 0
    const ht = hopOf.get(target) ?? 0
    // Colour edge by the outer hop so ring connections feel unified
    const edgeHop = Math.min(5, Math.max(hs, ht))
    const palette = hopStyle(edgeHop)
    const toLiteral =
      data.nodes.find((n) => n.id === source)?.type === 'literal' ||
      data.nodes.find((n) => n.id === target)?.type === 'literal'

    return {
      group: 'edges',
      data: {
        id: l.id,
        source,
        target,
        label: shortLabel(l.predicateLabel, 12),
        fullLabel: l.predicateLabel,
        predicate: l.predicate,
        edgeHop,
      },
      classes: [
        `edge-hop-${edgeHop}`,
        toLiteral ? 'literal-edge' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        'line-color': palette.edge,
        'target-arrow-color': palette.edge,
      },
    }
  })

  return [...nodes, ...links]
}

const CY_STYLE = [
  {
    selector: 'node',
    style: {
      label: 'data(label)',
      'font-family': 'Outfit, system-ui, sans-serif',
      'font-size': 10,
      'font-weight': 600,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '100px',
      'text-margin-y': 0,
      'text-outline-width': 0,
      'border-width': 2.5,
      'border-opacity': 1,
      'background-opacity': 1,
      'corner-radius': 9,
      'overlay-padding': 3,
      'z-index': 10,
    },
  },
  {
    selector: 'node.is-relation',
    style: {
      'font-size': 10,
      'font-weight': 700,
      'corner-radius': 6,
      'border-width': 0,
    },
  },
  {
    selector: 'node.is-root',
    style: {
      'font-size': 12,
      'font-weight': 700,
      'border-width': 3,
      shape: 'ellipse',
    },
  },
  {
    selector: 'node.hop-3',
    style: {
      'border-style': 'solid',
      'border-width': 2.5,
      opacity: 1,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-color': '#c9a227',
      'border-width': 3.5,
      'font-weight': 700,
      'z-index': 40,
      'underlay-color': '#f0c75e',
      'underlay-padding': 5,
      'underlay-opacity': 0.45,
      'underlay-shape': 'round-rectangle',
    },
  },
  {
    selector: 'node.on-path',
    style: {
      'border-color': '#c9a227',
      'underlay-color': '#f0c75e',
      'underlay-padding': 4,
      'underlay-opacity': 0.32,
      'underlay-shape': 'round-rectangle',
      'z-index': 30,
    },
  },
  {
    selector: 'node.is-literal',
    style: {
      'font-size': 8,
      'font-weight': 500,
      'border-style': 'dashed',
      'corner-radius': 7,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 2,
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.7,
      'curve-style': 'straight',
      label: 'data(label)',
      'font-family': 'Outfit, system-ui, sans-serif',
      'font-size': 7,
      'font-weight': 600,
      color: '#dce8e6',
      'text-background-color': '#0c1a1c',
      'text-background-opacity': 0.78,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'text-rotation': 'autorotate',
      'text-margin-y': -6,
      opacity: 0.88,
      'z-index': 1,
    },
  },
  {
    selector: 'edge.literal-edge',
    style: {
      'line-style': 'dashed',
      width: 1.4,
    },
  },
  {
    selector: 'edge.hot',
    style: {
      width: 2.6,
      'line-color': 'rgba(240, 199, 94, 0.9)',
      'target-arrow-color': 'rgba(240, 199, 94, 0.95)',
      color: '#ffe9a8',
      'font-size': 8,
      opacity: 1,
      'z-index': 20,
    },
  },
  {
    selector: 'edge.on-path',
    style: {
      width: 3.2,
      'line-color': '#f0c75e',
      'target-arrow-color': '#f0c75e',
      color: '#fff3c4',
      'font-size': 8,
      'font-weight': 700,
      opacity: 1,
      'z-index': 25,
    },
  },
  {
    selector: '.faded',
    style: {
      opacity: 0.18,
      'text-opacity': 0.14,
    },
  },
] as cytoscape.StylesheetStyle[]

/** Place seed centre; each hop ring = hubs + values at that entity distance. */
function placeHopOrbits(cy: Core, data: GraphData) {
  const root =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id
  if (!root) return

  cy.batch(() => {
    const rootNode = cy.getElementById(root)
    if (rootNode.nonempty()) rootNode.position({ x: 0, y: 0 })

    for (let hop = 1; hop <= 5; hop++) {
      const ringR = HOP_RADIUS[hop] ?? 150 + hop * 100
      const atHop = data.nodes.filter((n) => (n.__hopDepth ?? 0) === hop)
      const hubs = atHop.filter((n) => n.type === 'relation')
      const values = atHop.filter((n) => n.type !== 'relation')

      hubs.forEach((h, i) => {
        const angle = (i / Math.max(hubs.length, 1)) * Math.PI * 2 - Math.PI / 2
        const el = cy.getElementById(h.id)
        if (el.empty()) return
        el.position({
          x: Math.cos(angle) * ringR,
          y: Math.sin(angle) * ringR,
        })
      })

      const byHub = new Map<string, typeof values>()
      for (const v of values) {
        const key = v.__parentId || v.__clusterKey || ''
        const list = byHub.get(key) ?? []
        list.push(v)
        byHub.set(key, list)
      }

      for (const [hubId, kids] of byHub) {
        const hubEl = cy.getElementById(hubId)
        const hubPos = hubEl.nonempty()
          ? hubEl.position()
          : { x: Math.cos(-Math.PI / 2) * ringR, y: Math.sin(-Math.PI / 2) * ringR }
        const baseAngle = Math.atan2(hubPos.y, hubPos.x)
        kids.forEach((v, i) => {
          const spread = (i - (kids.length - 1) / 2) * 0.28
          const dist = 90 + (i % 2) * 16
          const el = cy.getElementById(v.id)
          if (el.empty()) return
          el.position({
            x: hubPos.x + Math.cos(baseAngle + spread) * dist,
            y: hubPos.y + Math.sin(baseAngle + spread) * dist,
          })
        })
      }
    }
  })
}

/** Pure concentric rings by hop depth (orbit view). */
function placeOrbitRings(cy: Core, data: GraphData) {
  const buckets = new Map<number, string[]>()
  for (const n of data.nodes) {
    const h = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const list = buckets.get(h) ?? []
    list.push(n.id)
    buckets.set(h, list)
  }
  const radii = [...HOP_RADIUS]
  const twist = [0, 0.12, -0.08, 0.18, -0.14, 0.1]

  cy.batch(() => {
    for (const [hop, ids] of buckets) {
      const r = radii[hop] ?? 150 + hop * 95
      ids.forEach((id, i) => {
        const angle =
          (twist[hop] ?? 0) + (i / Math.max(ids.length, 1)) * Math.PI * 2 - Math.PI / 2
        const wobble = hop === 0 ? 0 : Math.sin(i * 1.7) * 10
        const el = cy.getElementById(id)
        if (el.empty()) return
        el.position({
          x: Math.cos(angle) * (r + wobble),
          y: Math.sin(angle) * (r + wobble),
        })
      })
    }
  })
}

function fitAfter(cy: Core) {
  cy.stop()
  // Instant fit — avoid looping animations that look like “nodes keep moving”
  cy.fit(undefined, 48)
}

function runLayout(
  cy: Core,
  data: GraphData,
  selectedNodeId: string | null,
  mode: GraphLayoutMode,
) {
  const n = data.nodes.length
  if (!n) return

  cy.stop()
  const hasHubs = graphHasOntologyHubs(data)

  if (mode === 'orbit' || (mode === 'hops' && !hasHubs)) {
    // Class map & trees: concentric by stamped hop depth (not stacked at origin)
    placeOrbitRings(cy, data)
    fitAfter(cy)
    return
  }

  if (mode === 'hops') {
    placeHopOrbits(cy, data)
    fitAfter(cy)
    return
  }

  // Auto-arrange — run once, no continuous simulation
  cy.layout({
    name: 'cose-bilkent',
    animate: false,
    fit: true,
    padding: 48,
    nodeDimensionsIncludeLabels: true,
    idealEdgeLength: 100,
    edgeElasticity: 0.25,
    nestingFactor: 0.08,
    gravity: 0.4,
    numIter: Math.min(2500, 800 + n * 25),
    tile: true,
    randomize: true,
  } as cytoscape.LayoutOptions).run()
  void selectedNodeId
}

function applyHighlights(
  cy: Core,
  selectedNodeId: string | null,
  pathNodeIds: string[],
  pathLinkIds: string[],
  highlightedLinkId: string | null,
) {
  const pathN = new Set(pathNodeIds)
  const pathL = new Set(pathLinkIds)

  cy.batch(() => {
    cy.nodes().forEach((node) => {
      const id = node.id()
      const selected = id === selectedNodeId
      const onPath = pathN.has(id)
      node.removeClass('selected on-path')
      if (selected) node.addClass('selected')
      if (onPath) node.addClass('on-path')

      const boxW = Number(node.data('boxW') ?? 100)
      const boxH = Number(node.data('boxH') ?? 42)
      const bump = selected ? 8 : onPath ? 5 : 0
      node.style({
        width: boxW + bump,
        height: boxH + bump * 0.3,
        'background-color': node.data('fill'),
        'border-color': selected || onPath ? '#c9a227' : node.data('border'),
        color: node.data('textColor'),
        'text-max-width': Number(node.data('textMax') ?? boxW - 14),
      })
    })

    cy.edges().forEach((edge) => {
      const id = edge.id()
      const onPath = pathL.has(id)
      const src = edge.data('source') as string
      const tgt = edge.data('target') as string
      const hot =
        onPath ||
        id === highlightedLinkId ||
        src === selectedNodeId ||
        tgt === selectedNodeId
      edge.removeClass('hot on-path')
      if (hot) edge.addClass('hot')
      if (onPath) edge.addClass('on-path')

      if (!hot && !onPath) {
        const edgeHop = Number(edge.data('edgeHop') ?? 1)
        const palette = hopStyle(edgeHop)
        edge.style({
          'line-color': palette.edge,
          'target-arrow-color': palette.edge,
        })
      }
    })

    // Gold path highlight only — never ghost/disable other hops (esp. hop 3)
    cy.elements().removeClass('faded')
  })
}

function maxHop(data: GraphData) {
  return Math.max(0, ...data.nodes.map((n) => n.__hopDepth ?? 0))
}

export function KnowledgeGraph({
  data,
  selectedNodeId,
  highlightedLinkId,
  graphEpoch = 0,
  layoutKey = 0,
  fitKey = 0,
  pathNodeIds = [],
  pathLinkIds = [],
  layoutMode = 'hops',
  showLegend = true,
  onNodeClick,
  onNodeExpand,
  onBackgroundClick,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<Core | null>(null)
  const onNodeClickRef = useRef(onNodeClick)
  const onNodeExpandRef = useRef(onNodeExpand)
  const onBgRef = useRef(onBackgroundClick)
  const rawMap = useRef(new Map<string, GraphNode>())
  const lastEpoch = useRef(graphEpoch)
  const lastSig = useRef('')
  const layoutModeRef = useRef(layoutMode)
  const dataRef = useRef(data)
  const selectedRef = useRef(selectedNodeId)
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null)
  layoutModeRef.current = layoutMode
  dataRef.current = data
  selectedRef.current = selectedNodeId

  onNodeClickRef.current = onNodeClick
  onNodeExpandRef.current = onNodeExpand
  onBgRef.current = onBackgroundClick

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const cy = cytoscape({
      container: el,
      elements: [],
      style: CY_STYLE,
      minZoom: 0.2,
      maxZoom: 3.2,
      wheelSensitivity: 0.28,
      boxSelectionEnabled: false,
      autoungrabify: false,
    })
    cyRef.current = cy

    cy.on('tap', 'node', (evt) => {
      const raw = rawMap.current.get(evt.target.id())
      if (raw) onNodeClickRef.current(raw)
    })
    cy.on('dbltap', 'node', (evt) => {
      const raw = rawMap.current.get(evt.target.id())
      if (raw) onNodeExpandRef.current?.(raw)
    })
    cy.on('mouseover', 'node', (evt) => {
      const full = String(evt.target.data('fullLabel') || evt.target.data('label') || '')
      const short = String(evt.target.data('label') || '')
      if (!full || full === short) {
        setTip(null)
        return
      }
      const pos = evt.renderedPosition || evt.target.renderedPosition()
      setTip({ text: full, x: pos.x, y: pos.y })
    })
    cy.on('mouseout', 'node', () => setTip(null))
    cy.on('viewport', () => setTip(null))
    cy.on('tap', (evt) => {
      if (evt.target === cy) onBgRef.current?.()
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  // Sync graph structure — layout only when membership changes
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    rawMap.current = new Map(data.nodes.map((n) => [n.id, n]))
    const sig = `${graphEpoch}|${data.nodes.map((n) => n.id).sort().join(',')}|${data.links.map((l) => l.id).sort().join(',')}`
    const structureChanged = lastSig.current !== sig
    lastEpoch.current = graphEpoch
    lastSig.current = sig

    if (structureChanged) {
      cy.batch(() => {
        cy.elements().remove()
        cy.add(buildElements(data))
      })
      runLayout(cy, data, selectedNodeId, layoutModeRef.current)
    }

    applyHighlights(cy, selectedNodeId, pathNodeIds, pathLinkIds, highlightedLinkId)
  }, [
    data,
    selectedNodeId,
    pathNodeIds,
    pathLinkIds,
    highlightedLinkId,
    graphEpoch,
  ])

  // Manual layout mode / rearrange only — never depend on `data` (avoids endless motion)
  useEffect(() => {
    const cy = cyRef.current
    if (!cy || dataRef.current.nodes.length === 0) return
    runLayout(cy, dataRef.current, selectedRef.current, layoutMode)
  }, [layoutMode, layoutKey])

  useEffect(() => {
    if (fitKey === 0) return
    const cy = cyRef.current
    if (!cy) return
    cy.stop()
    cy.fit(undefined, 44)
  }, [fitKey])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selectedNodeId) return
    const el = cy.getElementById(selectedNodeId)
    if (el.empty()) return
    // Gentle pan only — do not re-run force layout
    cy.stop()
    cy.center(el)
  }, [selectedNodeId])

  const hopsVisible = maxHop(data)

  return (
    <div className="graph-stage">
      <div className={`graph-atmosphere hop-sky mode-${layoutMode}`} aria-hidden />
      <div className="graph-grid" aria-hidden />
      {layoutMode === 'orbit' && data.nodes.length > 0 && (
        <div className="hop-orbit-guide" aria-hidden data-hops={hopsVisible}>
          {[1, 2, 3].map((h) =>
            hopsVisible >= h ? (
              <span
                key={h}
                className={`hop-orbit-ring hop-orbit-${h}`}
                style={{
                  width: `${28 + h * 22}%`,
                  height: `${28 + h * 22}%`,
                }}
              />
            ) : null,
          )}
        </div>
      )}
      <div className="cy-host" ref={wrapRef} />
      {tip && (
        <div className="graph-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
          <span className="graph-tip-hint"> · double-click to show all attached</span>
        </div>
      )}
      {data.nodes.length > 0 && showLegend && <GraphLegend />}
      {data.nodes.length > 0 && (
        <div className="graph-hint">
          {layoutMode === 'hops' &&
            'Click a value (e.g. award) → Show all attached · double-click expands'}
          {layoutMode === 'orbit' && 'Orbit view · concentric hop rings'}
          {layoutMode === 'auto' && 'Auto-arrange · organic force layout'}
        </div>
      )}
    </div>
  )
}
