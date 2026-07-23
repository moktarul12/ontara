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

function shortLabel(label: string, max = 22) {
  const t = label.trim()
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
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
    if (n.__parentId) {
      kids.set(n.__parentId, (kids.get(n.__parentId) ?? 0) + 1)
    }
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
    const degree = degrees.get(n.id) ?? 0
    const card = informativeCard(n, {
      root: isRoot,
      degree,
      childCount: children.get(n.id) ?? 0,
    })
    // Slight size bump for highly connected hubs
    const hubBoost = n.type === 'relation' ? Math.min(18, (children.get(n.id) ?? 0) * 2) : 0
    const width = card.width + hubBoost
    const height = card.height

    return {
      group: 'nodes',
      data: {
        id: n.id,
        label: card.label,
        fullLabel: n.label,
        subtitle: card.subtitle,
        meta: card.meta,
        kind: card.kind,
        hopDepth: hop,
        hopBadge: hop === 0 ? 'SEED' : n.type === 'relation' ? `PROP·${hop}` : `H${hop}`,
        nodeType: n.type,
        uri: n.uri,
        degree,
        direction: n.__direction ?? '',
        classesLine: (n.classes ?? []).slice(0, 3).join(' · '),
        boxW: width,
        boxH: height,
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
        width,
        height,
        'background-color': colors.fill,
        'border-color': colors.border,
        color: colors.text,
        shape: isRoot ? 'round-rectangle' : 'round-rectangle',
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
    const toLiteral = srcNode?.type === 'literal' || tgtNode?.type === 'literal'
    const fromHub = srcNode?.type === 'relation'
    const pred = shortLabel(l.predicateLabel, fromHub ? 16 : 18)

    return {
      group: 'edges',
      data: {
        id: l.id,
        source,
        target,
        label: pred,
        fullLabel: l.predicateLabel,
        predicate: l.predicate,
        edgeHop,
      },
      classes: [`edge-hop-${edgeHop}`, toLiteral ? 'literal-edge' : '', fromHub ? 'from-hub' : '']
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
      'font-size': 9,
      'font-weight': 600,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'line-height': 1.15,
      'text-margin-y': 0,
      'text-outline-width': 0,
      'border-width': 2,
      'border-opacity': 1,
      'background-opacity': 1,
      'corner-radius': 10,
      'overlay-padding': 4,
      'z-index': 10,
    },
  },
  {
    selector: 'node.is-relation',
    style: {
      'font-size': 8.5,
      'font-weight': 700,
      'corner-radius': 8,
      'border-width': 0,
    },
  },
  {
    selector: 'node.is-root',
    style: {
      'font-size': 10.5,
      'font-weight': 700,
      'border-width': 3,
      'corner-radius': 14,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-color': '#e8c56a',
      'border-width': 3.5,
      'font-weight': 700,
      'z-index': 40,
      'underlay-color': '#e8c56a',
      'underlay-padding': 6,
      'underlay-opacity': 0.35,
      'underlay-shape': 'round-rectangle',
    },
  },
  {
    selector: 'node.on-path',
    style: {
      'border-color': '#e8c56a',
      'underlay-color': '#e8c56a',
      'underlay-padding': 4,
      'underlay-opacity': 0.22,
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
      width: 1.8,
      'target-arrow-shape': 'triangle',
      'arrow-scale': 0.75,
      'curve-style': 'bezier',
      'control-point-step-size': 28,
      label: 'data(label)',
      'font-family': 'Outfit, system-ui, sans-serif',
      'font-size': 8,
      'font-weight': 600,
      color: '#c5d8d4',
      'text-background-color': '#0e1c1e',
      'text-background-opacity': 0.88,
      'text-background-padding': '3px',
      'text-background-shape': 'roundrectangle',
      'text-rotation': 'autorotate',
      'text-margin-y': -8,
      opacity: 0.92,
      'z-index': 1,
    },
  },
  {
    selector: 'edge.from-hub',
    style: {
      width: 1.5,
      'font-size': 7.5,
      opacity: 0.85,
    },
  },
  {
    selector: 'edge.literal-edge',
    style: {
      'line-style': 'dashed',
      width: 1.3,
    },
  },
  {
    selector: 'edge.hot',
    style: {
      width: 2.8,
      'line-color': 'rgba(232, 197, 106, 0.92)',
      'target-arrow-color': 'rgba(232, 197, 106, 0.95)',
      color: '#ffe9a8',
      'font-size': 8.5,
      opacity: 1,
      'z-index': 20,
    },
  },
  {
    selector: 'edge.on-path',
    style: {
      width: 3.2,
      'line-color': '#e8c56a',
      'target-arrow-color': '#e8c56a',
      color: '#fff3c4',
      'font-size': 9,
      'font-weight': 700,
      opacity: 1,
      'z-index': 25,
    },
  },
  {
    selector: '.faded',
    style: {
      opacity: 0.16,
      'text-opacity': 0.12,
    },
  },
] as cytoscape.StylesheetStyle[]

function placeHopOrbits(cy: Core, data: GraphData) {
  const root =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id
  if (!root) return

  cy.batch(() => {
    const rootNode = cy.getElementById(root)
    if (rootNode.nonempty()) rootNode.position({ x: 0, y: 0 })

    for (let hop = 1; hop <= 5; hop++) {
      const ringR = HOP_RADIUS[hop] ?? 175 + hop * 110
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
          const spread = (i - (kids.length - 1) / 2) * 0.32
          const dist = 118 + (i % 2) * 22
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
    const h = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const list = buckets.get(h) ?? []
    list.push(n.id)
    buckets.set(h, list)
  }
  const radii = [...HOP_RADIUS]
  const twist = [0, 0.12, -0.08, 0.18, -0.14, 0.1]

  cy.batch(() => {
    for (const [hop, ids] of buckets) {
      const r = radii[hop] ?? 175 + hop * 100
      ids.forEach((id, i) => {
        const angle =
          (twist[hop] ?? 0) + (i / Math.max(ids.length, 1)) * Math.PI * 2 - Math.PI / 2
        const wobble = hop === 0 ? 0 : Math.sin(i * 1.7) * 12
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
  cy.fit(undefined, 52)
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
    padding: 52,
    nodeDimensionsIncludeLabels: true,
    idealEdgeLength: 120,
    edgeElasticity: 0.22,
    nestingFactor: 0.08,
    gravity: 0.35,
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

      const boxW = Number(node.data('boxW') ?? 120)
      const boxH = Number(node.data('boxH') ?? 56)
      const bump = selected ? 10 : onPath ? 6 : 0
      node.style({
        width: boxW + bump,
        height: boxH + bump * 0.25,
        'background-color': node.data('fill'),
        'border-color': selected || onPath ? '#e8c56a' : node.data('border'),
        color: node.data('textColor'),
        'text-max-width': Number(node.data('textMax') ?? boxW - 16),
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

    cy.elements().removeClass('faded')
  })
}

function maxHop(data: GraphData) {
  if (!data.nodes.length) return 0
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
    const deg = degreeMap(data).get(n.id) ?? 0
    const kids = childCountMap(data).get(n.id) ?? 0
    const kind = kindOf(n)
    return { node: n, deg, kids, kind, hop: n.__hopDepth ?? 0 }
  }, [data, selectedNodeId])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const cy = cytoscape({
      container: el,
      elements: [],
      style: CY_STYLE,
      minZoom: 0.18,
      maxZoom: 3.4,
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
      const meta = String(evt.target.data('meta') || '')
      const pos = evt.renderedPosition || evt.target.renderedPosition()
      setTip({
        text: [full, subtitle, meta].filter(Boolean).join('\n'),
        x: pos.x,
        y: pos.y,
      })
    })
    cy.on('mouseover', 'edge', (evt) => {
      const full = String(evt.target.data('fullLabel') || evt.target.data('label') || '')
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
    cy.fit(undefined, 48)
  }, [fitKey])

  useEffect(() => {
    const cy = cyRef.current
    if (!cy || !selectedNodeId) return
    const el = cy.getElementById(selectedNodeId)
    if (el.empty()) return
    cy.stop()
    cy.center(el)
  }, [selectedNodeId])

  const hopsVisible = maxHop(data)
  const kindLabel = focus ? KIND_STYLE[focus.kind].label : ''

  return (
    <div className="graph-stage">
      <div className={`graph-atmosphere fact-field mode-${layoutMode}`} aria-hidden />
      <div className="graph-grid" aria-hidden />
      {layoutMode === 'orbit' && data.nodes.length > 0 && (
        <div className="hop-orbit-guide" aria-hidden data-hops={hopsVisible}>
          {[1, 2, 3, 4, 5].map((h) =>
            hopsVisible >= h ? (
              <span
                key={h}
                className={`hop-orbit-ring hop-orbit-${Math.min(h, 3)}`}
                style={{
                  width: `${24 + h * 14}%`,
                  height: `${24 + h * 14}%`,
                }}
              />
            ) : null,
          )}
        </div>
      )}
      <div className="cy-host" ref={wrapRef} />

      {focus && (
        <aside className="graph-focus" aria-live="polite">
          <p className="graph-focus-kicker">
            {kindLabel}
            {focus.node.type === 'relation'
              ? ` · ${focus.node.__direction === 'in' ? 'incoming' : 'outgoing'} property`
              : ''}
            {' · '}
            hop {focus.hop}
          </p>
          <h3 className="graph-focus-title">{focus.node.label}</h3>
          <p className="graph-focus-meta">
            {focus.node.classes?.length
              ? focus.node.classes.slice(0, 3).join(' · ')
              : focus.node.type === 'relation'
                ? 'Ontology property hub'
                : 'Entity'}
            {' · '}
            {focus.node.type === 'relation'
              ? `${focus.kids} value${focus.kids === 1 ? '' : 's'} on graph`
              : `${focus.deg} connection${focus.deg === 1 ? '' : 's'}`}
            {' · '}
            double-click to expand
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
      {data.nodes.length > 0 && (
        <div className="graph-hint">
          Fact cards · kind · hop · links · double-click expands
        </div>
      )}
    </div>
  )
}
