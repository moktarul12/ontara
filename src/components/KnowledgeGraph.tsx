import { useEffect, useMemo, useRef, useState } from 'react'
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape'
import coseBilkent from 'cytoscape-cose-bilkent'
import type { GraphData, GraphLink, GraphNode } from '../types/ontology'
import {
  hopStyle,
  informativeCard,
  kindOf,
  ontologyNodeColors,
  KIND_STYLE,
  HOP_RADIUS,
  HUB_RADIUS_FACTOR,
} from '../utils/nodeKind'
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
  onNodeExpand?: (node: GraphNode) => void
  onBackgroundClick?: () => void
}

function linkEnds(l: GraphLink): { source: string; target: string } {
  const source = typeof l.source === 'string' ? l.source : l.source.id
  const target = typeof l.target === 'string' ? l.target : l.target.id
  return { source, target }
}

function degreeMap(data: GraphData): Map<string, number> {
  const deg = new Map<string, number>()
  for (const n of data.nodes) deg.set(n.id, 0)
  for (const l of data.links) {
    const { source, target } = linkEnds(l)
    deg.set(source, (deg.get(source) ?? 0) + 1)
    deg.set(target, (deg.get(target) ?? 0) + 1)
  }
  return deg
}

function childCountMap(data: GraphData): Map<string, number> {
  const kids = new Map<string, number>()
  for (const n of data.nodes) {
    if (n.__parentId) kids.set(n.__parentId, (kids.get(n.__parentId) ?? 0) + 1)
  }
  return kids
}

function buildElements(data: GraphData): ElementDefinition[] {
  const hopOf = new Map(data.nodes.map((n) => [n.id, n.__hopDepth ?? 0]))
  const rootId =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id
  const degrees = degreeMap(data)
  const children = childCountMap(data)

  const nodes: ElementDefinition[] = data.nodes.map((n) => {
    const hop = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const colors = ontologyNodeColors(n)
    const isRoot = n.id === rootId
    const card = informativeCard(n, {
      root: isRoot,
      degree: degrees.get(n.id) ?? 0,
      childCount: children.get(n.id) ?? 0,
    })

    return {
      group: 'nodes',
      data: {
        id: n.id,
        label: card.label,
        fullLabel: n.label,
        subtitle: card.subtitle,
        kind: card.kind,
        hopDepth: hop,
        nodeType: n.type,
        uri: n.uri,
        degree: degrees.get(n.id) ?? 0,
        direction: n.__direction ?? '',
        classesLine: (n.classes ?? []).slice(0, 3).join(' · '),
        boxW: card.width,
        boxH: card.height,
        textMax: card.textMax,
        clusterKey: n.__clusterKey ?? '',
        parentId: n.__parentId ?? '',
        fill: colors.fill,
        border: colors.border,
        textColor: colors.text,
      },
      classes: [
        `hop-${hop}`,
        `kind-${card.kind}`,
        n.type === 'literal' ? 'is-literal' : '',
        n.type === 'relation' ? 'is-relation' : '',
        isRoot ? 'is-root' : '',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        width: card.width,
        height: card.height,
        'background-color': colors.fill,
        'border-color': colors.border,
        color: colors.text,
        shape: 'round-rectangle',
        'text-max-width': card.textMax,
      },
    }
  })

  const links: ElementDefinition[] = data.links.map((l) => {
    const { source, target } = linkEnds(l)
    const hs = hopOf.get(source) ?? 0
    const ht = hopOf.get(target) ?? 0
    const edgeHop = Math.min(5, Math.max(hs, ht))
    const palette = hopStyle(edgeHop)
    const srcNode = data.nodes.find((n) => n.id === source)
    const tgtNode = data.nodes.find((n) => n.id === target)
    const hubEdge =
      srcNode?.type === 'relation' || tgtNode?.type === 'relation'
    const toLiteral = srcNode?.type === 'literal' || tgtNode?.type === 'literal'
    // Hub edges stay silent — predicate lives on the chip
    const label = hubEdge ? '' : (l.predicateLabel || '').slice(0, 16)

    return {
      group: 'edges',
      data: {
        id: l.id,
        source,
        target,
        label,
        fullLabel: l.predicateLabel || srcNode?.label || tgtNode?.label || '',
        predicate: l.predicate,
        edgeHop,
      },
      classes: [
        `edge-hop-${edgeHop}`,
        toLiteral ? 'literal-edge' : '',
        hubEdge ? 'hub-edge' : '',
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
      'text-max-width': '120px',
      'border-width': 2,
      'border-opacity': 1,
      'background-opacity': 1,
      'corner-radius': 10,
      'overlay-padding': 3,
      'z-index': 10,
    },
  },
  {
    selector: 'node.is-relation',
    style: {
      'font-size': 9,
      'font-weight': 700,
      'corner-radius': 999,
      'border-width': 0,
      'z-index': 8,
    },
  },
  {
    selector: 'node.is-root',
    style: {
      'font-size': 11,
      'font-weight': 700,
      'border-width': 3,
      'corner-radius': 14,
      'z-index': 20,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-color': '#e8c56a',
      'border-width': 3.5,
      'z-index': 40,
      'underlay-color': '#e8c56a',
      'underlay-padding': 5,
      'underlay-opacity': 0.32,
      'underlay-shape': 'round-rectangle',
    },
  },
  {
    selector: 'node.on-path',
    style: {
      'border-color': '#e8c56a',
      'underlay-color': '#e8c56a',
      'underlay-padding': 3,
      'underlay-opacity': 0.2,
      'z-index': 30,
    },
  },
  {
    selector: 'node.is-literal',
    style: {
      'font-size': 9,
      'font-weight': 500,
      'border-style': 'dashed',
      'corner-radius': 8,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.6,
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.65,
      'curve-style': 'bezier',
      'control-point-step-size': 22,
      label: 'data(label)',
      'font-family': 'Outfit, system-ui, sans-serif',
      'font-size': 8,
      'font-weight': 600,
      color: '#b8ccc8',
      'text-background-color': '#0e1c1e',
      'text-background-opacity': 0.85,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'text-rotation': 'autorotate',
      'text-margin-y': -6,
      opacity: 0.85,
      'z-index': 1,
    },
  },
  {
    selector: 'edge.hub-edge',
    style: {
      width: 1.4,
      'target-arrow-shape': 'none',
      label: '',
      opacity: 0.55,
    },
  },
  {
    selector: 'edge.literal-edge',
    style: {
      'line-style': 'dashed',
      width: 1.2,
    },
  },
  {
    selector: 'edge.hot',
    style: {
      width: 2.4,
      'line-color': 'rgba(232, 197, 106, 0.9)',
      'target-arrow-color': 'rgba(232, 197, 106, 0.95)',
      opacity: 1,
      'z-index': 20,
    },
  },
  {
    selector: 'edge.on-path',
    style: {
      width: 3,
      'line-color': '#e8c56a',
      'target-arrow-color': '#e8c56a',
      opacity: 1,
      'z-index': 25,
    },
  },
] as cytoscape.StylesheetStyle[]

/**
 * Proper KG layout:
 * Seed at centre.
 * For each entity hop: property chips on an inner arc, values fanned past their hub.
 */
function placeHopOrbits(cy: Core, data: GraphData) {
  const root =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id
  if (!root) return

  cy.batch(() => {
    const rootNode = cy.getElementById(root)
    if (rootNode.nonempty()) rootNode.position({ x: 0, y: 0 })

    for (let hop = 1; hop <= 5; hop++) {
      const valueR = HOP_RADIUS[hop] ?? 200 + hop * 140
      const hubR = valueR * HUB_RADIUS_FACTOR
      const atHop = data.nodes.filter((n) => (n.__hopDepth ?? 0) === hop)
      const hubs = atHop.filter((n) => n.type === 'relation')
      const values = atHop.filter((n) => n.type !== 'relation')

      hubs.forEach((h, i) => {
        const angle = (i / Math.max(hubs.length, 1)) * Math.PI * 2 - Math.PI / 2
        const el = cy.getElementById(h.id)
        if (el.empty()) return
        el.position({ x: Math.cos(angle) * hubR, y: Math.sin(angle) * hubR })
      })

      const byHub = new Map<string, typeof values>()
      for (const v of values) {
        const key = v.__parentId || v.__clusterKey || '_loose'
        const list = byHub.get(key) ?? []
        list.push(v)
        byHub.set(key, list)
      }

      for (const [hubId, kids] of byHub) {
        const hubEl = cy.getElementById(hubId)
        const hubPos = hubEl.nonempty()
          ? hubEl.position()
          : {
              x: Math.cos(-Math.PI / 2) * hubR,
              y: Math.sin(-Math.PI / 2) * hubR,
            }
        const baseAngle = Math.atan2(hubPos.y, hubPos.x)
        const dist = Math.max(88, valueR - hubR)
        kids.forEach((v, i) => {
          const spread = (i - (kids.length - 1) / 2) * 0.38
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

function placeOrbitRings(cy: Core, data: GraphData) {
  const buckets = new Map<number, string[]>()
  for (const n of data.nodes) {
    if (n.type === 'relation') continue // hubs handled with parents in hops; skip in pure orbit
    const h = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const list = buckets.get(h) ?? []
    list.push(n.id)
    buckets.set(h, list)
  }
  // Place hubs near their parent entity angle
  const hubs = data.nodes.filter((n) => n.type === 'relation')

  cy.batch(() => {
    for (const [hop, ids] of buckets) {
      const r = HOP_RADIUS[hop] ?? 200 + hop * 140
      ids.forEach((id, i) => {
        const angle = (i / Math.max(ids.length, 1)) * Math.PI * 2 - Math.PI / 2
        const el = cy.getElementById(id)
        if (el.empty()) return
        el.position({ x: Math.cos(angle) * r, y: Math.sin(angle) * r })
      })
    }
    for (const h of hubs) {
      const parent = h.__parentId
      const parentEl = parent ? cy.getElementById(parent) : null
      const hop = h.__hopDepth ?? 1
      const r = (HOP_RADIUS[hop] ?? 210) * HUB_RADIUS_FACTOR
      const el = cy.getElementById(h.id)
      if (el.empty()) continue
      if (parentEl && parentEl.nonempty()) {
        const p = parentEl.position()
        const ang = Math.atan2(p.y, p.x)
        el.position({ x: Math.cos(ang) * r, y: Math.sin(ang) * r })
      } else {
        el.position({ x: 0, y: -r })
      }
    }
  })
}

function fitAfter(cy: Core) {
  cy.stop()
  cy.fit(undefined, 56)
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
    placeOrbitRings(cy, data)
    fitAfter(cy)
    return
  }
  if (mode === 'hops') {
    placeHopOrbits(cy, data)
    fitAfter(cy)
    return
  }

  cy.layout({
    name: 'cose-bilkent',
    animate: false,
    fit: true,
    padding: 56,
    nodeDimensionsIncludeLabels: true,
    idealEdgeLength: 110,
    edgeElasticity: 0.2,
    gravity: 0.35,
    numIter: Math.min(2200, 700 + n * 22),
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
      const boxH = Number(node.data('boxH') ?? 44)
      const bump = selected ? 8 : onPath ? 4 : 0
      node.style({
        width: boxW + bump,
        height: boxH + bump * 0.2,
        'background-color': node.data('fill'),
        'border-color': selected || onPath ? '#e8c56a' : node.data('border'),
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
        const palette = hopStyle(Number(edge.data('edgeHop') ?? 1))
        edge.style({
          'line-color': palette.edge,
          'target-arrow-color': palette.edge,
        })
      }
    })
  })
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

  const focus = useMemo(() => {
    if (!selectedNodeId) return null
    const n = data.nodes.find((x) => x.id === selectedNodeId)
    if (!n) return null
    return {
      node: n,
      deg: degreeMap(data).get(n.id) ?? 0,
      kids: childCountMap(data).get(n.id) ?? 0,
      kind: kindOf(n),
      hop: n.__hopDepth ?? 0,
    }
  }, [data, selectedNodeId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const cy = cytoscape({
      container: el,
      elements: [],
      style: CY_STYLE,
      minZoom: 0.18,
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
      const full = String(evt.target.data('fullLabel') || '')
      const subtitle = String(evt.target.data('subtitle') || '')
      const kind = String(evt.target.data('kind') || '')
      const hop = evt.target.data('hopDepth')
      const pos = evt.renderedPosition || evt.target.renderedPosition()
      setTip({
        text: [full, subtitle || KIND_STYLE[kind as keyof typeof KIND_STYLE]?.label, `hop ${hop}`]
          .filter(Boolean)
          .join('\n'),
        x: pos.x,
        y: pos.y,
      })
    })
    cy.on('mouseover', 'edge', (evt) => {
      const full = String(evt.target.data('fullLabel') || '')
      if (!full) return
      const pos = evt.renderedPosition || evt.target.midpoint()
      setTip({ text: full, x: pos.x, y: pos.y })
    })
    cy.on('mouseout', 'node, edge', () => setTip(null))
    cy.on('viewport', () => setTip(null))
    cy.on('tap', (evt) => {
      if (evt.target === cy) onBgRef.current?.()
    })

    return () => {
      cy.destroy()
      cyRef.current = null
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return
    rawMap.current = new Map(data.nodes.map((n) => [n.id, n]))
    const sig = `${graphEpoch}|${data.nodes.map((n) => n.id).sort().join(',')}|${data.links.map((l) => l.id).sort().join(',')}`
    const structureChanged = lastSig.current !== sig
    lastSig.current = sig

    if (structureChanged) {
      cy.batch(() => {
        cy.elements().remove()
        cy.add(buildElements(data))
      })
      runLayout(cy, data, selectedNodeId, layoutModeRef.current)
    }
    applyHighlights(cy, selectedNodeId, pathNodeIds, pathLinkIds, highlightedLinkId)
  }, [data, selectedNodeId, pathNodeIds, pathLinkIds, highlightedLinkId, graphEpoch])

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
    cy.fit(undefined, 52)
  }, [fitKey])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selectedNodeId) return
    const el = cy.getElementById(selectedNodeId)
    if (el.empty()) return
    cy.stop()
    cy.center(el)
  }, [selectedNodeId])

  const kindLabel = focus ? KIND_STYLE[focus.kind].label : ''

  return (
    <div className="graph-stage">
      <div className={`graph-atmosphere fact-field mode-${layoutMode}`} aria-hidden />
      <div className="graph-grid" aria-hidden />
      <div className="cy-host" ref={wrapRef} />

      {focus && (
        <aside className="graph-focus" aria-live="polite">
          <p className="graph-focus-kicker">
            {focus.node.type === 'relation'
              ? `${focus.node.__direction === 'in' ? 'Incoming' : 'Outgoing'} property`
              : kindLabel}
            {' · '}
            hop {focus.hop}
          </p>
          <h3 className="graph-focus-title">{focus.node.label}</h3>
          <p className="graph-focus-meta">
            {focus.node.type === 'relation'
              ? `${focus.kids} value${focus.kids === 1 ? '' : 's'} · click values or expand`
              : focus.node.classes?.length
                ? focus.node.classes.slice(0, 3).join(' · ')
                : 'Entity'}
            {focus.node.type !== 'relation' ? ` · ${focus.deg} links` : ''}
            {' · '}
            double-click expands
          </p>
        </aside>
      )}

      {tip && (
        <div className="graph-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text.split('\n').map((line, i) => (
            <span key={i} className={i === 0 ? 'graph-tip-title' : 'graph-tip-line'}>
              {line}
            </span>
          ))}
        </div>
      )}
      {data.nodes.length > 0 && showLegend && <GraphLegend />}
      {data.nodes.length > 0 && !focus && (
        <div className="graph-hint">
          Seed → property chip → values · start sparse · grow with hops or double-click
        </div>
      )}
    </div>
  )
}
