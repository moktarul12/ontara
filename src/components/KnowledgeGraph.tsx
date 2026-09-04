import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  atlasShape,
} from '../utils/nodeKind'
import { graphHasOntologyHubs } from '../utils/treeLayout'
import { buildKinMaps, roleBadge } from '../utils/familyTreeGraph'
import { GraphLegend } from './GraphLegend'

cytoscape.use(coseBilkent)

export type GraphLayoutMode =
  | 'hops'
  | 'orbit'
  | 'auto'
  | 'family'
  | 'family-cascade'
  | 'family-tree'

export function isFamilyLayout(mode: GraphLayoutMode): boolean {
  return mode === 'family' || mode === 'family-cascade' || mode === 'family-tree'
}

export type KnowledgeGraphHandle = {
  exportImage: (format: 'png' | 'jpg') => Promise<void>
}

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
  /** Merge kinship around a person without wiping the graph */
  onExpandFamily?: (node: GraphNode) => void
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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
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
    const isFamilyPerson =
      n.type !== 'relation' &&
      n.type !== 'literal' &&
      (n.__familyRole != null || typeof n.__familyGen === 'number')
    const hasImage = Boolean(n.__imageUrl && (isRoot || n.type === 'resource'))
    const card = informativeCard(n, {
      root: isRoot,
      degree: degrees.get(n.id) ?? 0,
      childCount: children.get(n.id) ?? 0,
    })
    const role = isFamilyPerson ? roleBadge(n.__familyRole) : ''
    // Mockup: seed stays circular with portrait; relatives are tall rounded cards
    const familyFocus = isFamilyPerson && (n.__familyRole === 'seed' || isRoot)
    let shape = atlasShape(n, isRoot)
    let boxW = isRoot
      ? hasImage
        ? 112
        : Math.max(card.width, 110)
      : n.type === 'relation'
        ? Math.max(card.width, 70)
        : card.kind === 'person'
          ? Math.max(card.width, 92)
          : card.width
    let boxH = isRoot
      ? hasImage
        ? 108
        : 52
      : n.type === 'relation'
        ? 22
        : card.kind === 'person'
          ? Math.max(card.height, 42)
          : card.height
    let label = card.label

    if (isFamilyPerson && n.type !== 'relation') {
      if (familyFocus && hasImage) {
        shape = 'ellipse'
        boxW = 120
        boxH = 120
        label = card.title
      } else {
        shape = 'round-rectangle'
        boxW = 98
        boxH = 112
        const name = card.title.length > 20 ? `${card.title.slice(0, 19)}…` : card.title
        label = role ? `${name}\n— ${role} —` : name
      }
    }

    return {
      group: 'nodes',
      data: {
        id: n.id,
        label,
        fullLabel: n.label,
        subtitle: role || card.subtitle,
        kind: card.kind,
        hopDepth: hop,
        nodeType: n.type,
        uri: n.uri,
        degree: degrees.get(n.id) ?? 0,
        direction: n.__direction ?? '',
        classesLine: (n.classes ?? []).slice(0, 3).join(' · '),
        boxW,
        boxH,
        textMax: isFamilyPerson && !familyFocus ? boxW - 12 : card.textMax,
        clusterKey: n.__clusterKey ?? '',
        parentId: n.__parentId ?? '',
        fill: isFamilyPerson && !familyFocus ? '#fffaf3' : colors.fill,
        border: isFamilyPerson
          ? n.__familyRole === 'spouse'
            ? '#b45309'
            : n.__familyRole === 'sibling'
              ? '#c0267a'
              : n.__familyRole === 'parent'
                ? '#0d7a72'
                : familyFocus
                  ? '#c07818'
                  : '#c4b8a8'
          : colors.border,
        textColor: isFamilyPerson && !familyFocus ? '#1a2332' : colors.text,
        imageUrl: n.__imageUrl ?? '',
        atlasShape: shape,
        familyRole: n.__familyRole ?? '',
      },
      classes: [
        `hop-${hop}`,
        `kind-${card.kind}`,
        n.type === 'literal' ? 'is-literal' : '',
        n.type === 'relation' ? 'is-relation' : '',
        n.type === 'relation' &&
        (n.classes?.includes('Kinship') || n.id.startsWith('relhub:'))
          ? 'is-kinship'
          : '',
        n.type === 'relation' &&
        (n.classes?.includes('Kinship') || n.id.startsWith('relhub:'))
          ? `kin-${(n.label || 'link').toLowerCase().replace(/\s+/g, '-')}`
          : '',
        isFamilyPerson && n.type !== 'relation' ? 'family-card' : '',
        familyFocus ? 'family-seed' : '',
        isFamilyPerson && n.__familyRole ? `family-role-${n.__familyRole}` : '',
        isRoot ? 'is-root' : '',
        hasImage ? 'has-image' : '',
        `shape-${card.kind}`,
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        width: boxW,
        height: boxH,
        'background-color': isFamilyPerson && !familyFocus ? '#fffaf3' : colors.fill,
        'border-color': isFamilyPerson
          ? n.__familyRole === 'spouse'
            ? '#b45309'
            : familyFocus
              ? '#c07818'
              : '#c4b8a8'
          : colors.border,
        color: isFamilyPerson && !familyFocus ? '#1a2332' : colors.text,
        shape,
        'text-max-width': isFamilyPerson && !familyFocus ? boxW - 12 : card.textMax,
        ...(hasImage
          ? {
              'background-image': n.__imageUrl,
              'background-image-crossorigin': 'anonymous',
              'background-fit': 'cover',
              'background-clip': 'node',
              'background-image-opacity': 1,
              'background-position-y': '0%',
              'background-height': familyFocus ? '78%' : isRoot ? '72%' : '100%',
              'background-width': '100%',
              'text-valign': familyFocus || isRoot ? 'bottom' : 'center',
              'text-margin-y': familyFocus || isRoot ? 8 : 0,
              'text-background-color': '#ffffff',
              'text-background-opacity': familyFocus || isRoot ? 0.92 : 0,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
            }
          : {}),
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
    const hubNode =
      srcNode?.type === 'relation'
        ? srcNode
        : tgtNode?.type === 'relation'
          ? tgtNode
          : undefined
    const hubEdge = Boolean(hubNode)
    const kinEdge = source.startsWith('relhub:') || target.startsWith('relhub:')
    const kinLabel = (hubNode?.label || '').toLowerCase()
    const kinLine = kinEdge
      ? `kin-line-${kinLabel.replace(/\s+/g, '-') || 'link'}`
      : ''
    const kinAxis =
      kinEdge && (kinLabel === 'spouse' || kinLabel === 'sibling')
        ? 'kin-lateral'
        : kinEdge
          ? 'kin-vertical'
          : ''
    const toLiteral = srcNode?.type === 'literal' || tgtNode?.type === 'literal'
    const dir = srcNode?.__direction || tgtNode?.__direction || 'out'
    const label = hubEdge ? '' : (l.predicateLabel || '').slice(0, 16)

    return {
      group: 'edges',
      data: {
        id: l.id,
        source,
        target,
        label,
        fullLabel:
          l.predicateLabel ||
          srcNode?.label ||
          tgtNode?.label ||
          'related to',
        predicate: l.predicate,
        edgeHop,
        flow: dir,
      },
      classes: [
        `edge-hop-${edgeHop}`,
        toLiteral ? 'literal-edge' : '',
        kinEdge ? 'kin-edge' : hubEdge ? 'hub-edge' : '',
        kinAxis,
        kinLine,
        dir === 'in' ? 'flow-in' : 'flow-out',
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        'line-color': palette.edge,
        'target-arrow-color': palette.edge,
        'source-arrow-color': palette.edge,
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
      'font-family': 'Syne, DM Sans, system-ui, sans-serif',
      'font-size': 10,
      'font-weight': 650,
      'text-valign': 'center',
      'text-halign': 'center',
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'border-width': 2.2,
      'border-opacity': 1,
      'background-opacity': 1,
      'overlay-padding': 4,
      'z-index': 10,
      'shadow-blur': 8,
      'shadow-color': 'rgba(26, 35, 50, 0.12)',
      'shadow-opacity': 0.55,
      'shadow-offset-x': 0,
      'shadow-offset-y': 2,
    },
  },
  {
    selector: 'node.is-relation',
    style: {
      'font-family': 'DM Sans, system-ui, sans-serif',
      'font-size': 8.5,
      'font-weight': 800,
      'border-width': 1.4,
      'z-index': 8,
      'shadow-opacity': 0.25,
      shape: 'round-tag',
    },
  },
  {
    selector: 'node.is-kinship',
    style: {
      'font-size': 8,
      'font-weight': 800,
      'letter-spacing': 0.35,
      'text-transform': 'capitalize',
      'border-width': 0,
      'background-color': '#2f9e8f',
      color: '#ffffff',
      shape: 'round-rectangle',
      width: 70,
      height: 22,
      'z-index': 20,
      'shadow-blur': 0,
      'shadow-opacity': 0,
      'text-valign': 'center',
      'text-halign': 'center',
    },
  },
  {
    selector: 'node.is-kinship.kin-spouse',
    style: { 'background-color': '#8b6bb5' },
  },
  {
    selector: 'node.is-kinship.kin-sibling',
    style: { 'background-color': '#d4789a' },
  },
  {
    selector: 'node.is-kinship.kin-child, node.is-kinship.kin-children',
    style: { 'background-color': '#c45c5c' },
  },
  {
    selector: 'node.is-kinship.kin-father, node.is-kinship.kin-mother, node.is-kinship.kin-parents',
    style: { 'background-color': '#2f9e8f' },
  },
  {
    selector: 'edge.kin-edge',
    style: {
      width: 1.75,
      'curve-style': 'straight',
      'target-arrow-shape': 'none',
      'source-arrow-shape': 'none',
      'source-endpoint': 'outside-to-node',
      'target-endpoint': 'outside-to-node',
      label: '',
      opacity: 0.88,
      'line-color': 'rgba(47, 158, 143, 0.75)',
    },
  },
  {
    // Spouse / sibling: clean horizontal bar through the pill (no taxi zigzags)
    selector: 'edge.kin-edge.kin-lateral',
    style: {
      'curve-style': 'straight',
      width: 1.85,
    },
  },
  {
    // Parent / child stems: soft orthogonal T-junctions
    selector: 'edge.kin-edge.kin-vertical, edge.kin-edge.tree-trunk',
    style: {
      'curve-style': 'round-taxi',
      'taxi-direction': 'downward',
      'taxi-turn': 42,
      'taxi-turn-min-distance': 28,
      'taxi-radius': 10,
      width: 1.9,
      opacity: 0.9,
    },
  },
  {
    selector: 'edge.kin-edge.kin-line-spouse',
    style: { 'line-color': 'rgba(139, 107, 181, 0.9)' },
  },
  {
    selector: 'edge.kin-edge.kin-line-sibling',
    style: { 'line-color': 'rgba(212, 120, 154, 0.9)' },
  },
  {
    selector: 'edge.kin-edge.kin-line-child, edge.kin-edge.kin-line-children',
    style: { 'line-color': 'rgba(196, 92, 92, 0.85)' },
  },
  {
    selector:
      'edge.kin-edge.kin-line-father, edge.kin-edge.kin-line-mother, edge.kin-edge.kin-line-parents',
    style: { 'line-color': 'rgba(47, 158, 143, 0.9)' },
  },
  {
    selector: 'node.is-person',
    style: {
      'font-size': 10.5,
      'font-weight': 700,
      shape: 'ellipse',
      'text-margin-y': 2,
    },
  },
  {
    selector: 'node.family-card',
    style: {
      shape: 'round-rectangle',
      'background-color': '#fffaf3',
      'border-width': 1.6,
      'border-color': '#c4b8a8',
      color: '#1a2332',
      'font-size': 9,
      'font-weight': 700,
      'text-wrap': 'wrap',
      'text-valign': 'center',
      'text-halign': 'center',
      'line-height': 1.2,
      'shadow-blur': 12,
      'shadow-color': 'rgba(26, 35, 50, 0.16)',
      'shadow-opacity': 0.7,
      'shadow-offset-y': 3,
      'z-index': 14,
    },
  },
  {
    selector: 'node.family-seed',
    style: {
      shape: 'ellipse',
      'border-color': '#c07818',
      'border-width': 4,
      'background-color': '#fff8ef',
      'z-index': 30,
      'shadow-blur': 16,
      'shadow-color': 'rgba(192, 120, 24, 0.4)',
      'shadow-opacity': 0.85,
    },
  },
  {
    selector: 'node.family-role-parent',
    style: {
      'border-color': '#0d7a72',
      color: '#0d7a72',
    },
  },
  {
    selector: 'node.family-role-spouse',
    style: {
      'border-color': '#b45309',
      color: '#9a3412',
    },
  },
  {
    selector: 'node.family-role-sibling',
    style: {
      'border-color': '#c0267a',
      color: '#9d174d',
    },
  },
  {
    selector: 'node.family-role-child',
    style: {
      'border-color': '#4f46e5',
      color: '#3730a3',
    },
  },
  {
    selector: 'edge.pedigree-edge',
    style: {
      label: 'data(label)',
      'font-size': 8,
      'font-weight': 700,
      'text-rotation': 'autorotate',
      'text-background-color': '#fffdf8',
      'text-background-opacity': 0.92,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      color: '#0f766e',
      'target-arrow-shape': 'none',
    },
  },
  {
    selector: 'edge.pedigree-vertical',
    style: {
      width: 2.4,
      'curve-style': 'taxi',
      'taxi-direction': 'vertical',
      'taxi-turn': 48,
      'taxi-turn-min-distance': 22,
      'line-color': 'rgba(13, 122, 114, 0.65)',
    },
  },
  {
    selector: 'edge.pedigree-lateral',
    style: {
      width: 2,
      'curve-style': 'bezier',
      'line-style': 'dashed',
      'line-dash-pattern': [6, 4],
      'line-color': 'rgba(180, 83, 9, 0.55)',
      color: '#b45309',
    },
  },
  {
    selector: 'edge.pedigree-father',
    style: { color: '#0d9488', 'line-color': 'rgba(13, 148, 136, 0.7)' },
  },
  {
    selector: 'edge.pedigree-mother',
    style: { color: '#db2777', 'line-color': 'rgba(219, 39, 119, 0.55)' },
  },
  {
    selector: 'node.is-root',
    style: {
      'font-size': 11,
      'font-weight': 700,
      'border-width': 4,
      'z-index': 24,
      shape: 'ellipse',
      'shadow-blur': 22,
      'shadow-color': 'rgba(192, 120, 24, 0.35)',
      'shadow-opacity': 0.9,
    },
  },
  { selector: 'node.kind-person', style: { shape: 'ellipse' } },
  {
    selector: 'node.family-card, node.family-card.kind-person',
    style: { shape: 'round-rectangle' },
  },
  {
    selector: 'node.family-seed, node.family-seed.kind-person',
    style: { shape: 'ellipse' },
  },
  { selector: 'node.kind-work', style: { shape: 'barrel' } },
  { selector: 'node.kind-place', style: { shape: 'hexagon' } },
  { selector: 'node.kind-org', style: { shape: 'octagon' } },
  { selector: 'node.kind-concept', style: { shape: 'diamond' } },
  { selector: 'node.kind-character', style: { shape: 'star' } },
  { selector: 'node.kind-class', style: { shape: 'pentagon' } },
  {
    selector: 'node.has-image',
    style: {
      'background-opacity': 1,
      'border-width': 3,
      'background-image-crossorigin': 'anonymous',
    },
  },
  {
    selector: 'node.is-root.has-image',
    style: {
      width: 126,
      height: 126,
      'background-height': '100%',
      'text-valign': 'bottom',
      'text-margin-y': 10,
    },
  },
  {
    selector: 'node.selected',
    style: {
      'border-color': '#c07818',
      'border-width': 4.5,
      'z-index': 40,
      'underlay-color': '#c07818',
      'underlay-padding': 12,
      'underlay-opacity': 0.22,
      'underlay-shape': 'ellipse',
      'shadow-blur': 24,
      'shadow-color': 'rgba(192, 120, 24, 0.5)',
      'shadow-opacity': 1,
    },
  },
  {
    selector: 'node.on-path',
    style: {
      'border-color': '#c07818',
      'underlay-color': '#c07818',
      'underlay-padding': 4,
      'underlay-opacity': 0.12,
      'z-index': 30,
    },
  },
  {
    selector: 'node.is-literal',
    style: {
      'font-size': 9,
      'font-weight': 500,
      'border-style': 'dashed',
      shape: 'bottom-round-rectangle',
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.7,
      'curve-style': 'unbundled-bezier',
      'control-point-distances': [28, -12],
      'control-point-weights': [0.35, 0.7],
      'target-arrow-shape': 'triangle',
      'target-arrow-fill': 'filled',
      'arrow-scale': 1.05,
      'source-endpoint': 'outside-to-node',
      'target-endpoint': 'outside-to-node',
      label: 'data(label)',
      'font-family': 'DM Sans, system-ui, sans-serif',
      'font-size': 7.5,
      'font-weight': 700,
      color: '#5a6578',
      'text-background-color': '#fffdf8',
      'text-background-opacity': 0.94,
      'text-background-padding': '2px',
      'text-background-shape': 'roundrectangle',
      'text-rotation': 'autorotate',
      'text-margin-y': -6,
      opacity: 0.88,
      'z-index': 1,
      'line-cap': 'round',
    },
  },
  {
    selector: 'edge.hub-edge',
    style: {
      width: 1.55,
      'curve-style': 'haystack',
      'haystack-radius': 0.55,
      'target-arrow-shape': 'none',
      label: '',
      opacity: 0.55,
    },
  },
  {
    selector: 'edge.flow-in',
    style: {
      'line-style': 'solid',
      'target-arrow-shape': 'triangle',
      width: 1.9,
    },
  },
  {
    selector: 'edge.literal-edge',
    style: {
      'line-style': 'dashed',
      width: 1.2,
      'target-arrow-shape': 'tee',
      'arrow-scale': 0.85,
      'curve-style': 'bezier',
    },
  },
  {
    selector: 'edge.hot',
    style: {
      width: 2.6,
      'curve-style': 'unbundled-bezier',
      'line-color': 'rgba(192, 120, 24, 0.92)',
      'target-arrow-color': 'rgba(192, 120, 24, 1)',
      'target-arrow-shape': 'triangle',
      'arrow-scale': 1.2,
      opacity: 1,
      'z-index': 20,
    },
  },
  {
    selector: 'edge.on-path',
    style: {
      width: 3,
      'line-color': '#c07818',
      'target-arrow-color': '#c07818',
      'arrow-scale': 1.28,
      opacity: 1,
      'z-index': 25,
    },
  },
] as cytoscape.StylesheetStyle[]

type AtlasHalf = { hw: number; hh: number }

function atlasHalfSize(cy: Core, id: string): AtlasHalf {
  const el = cy.getElementById(id)
  if (el.empty()) return { hw: 52, hh: 24 }
  return {
    hw: Number(el.data('boxW') ?? 100) / 2 + 10,
    hh: Number(el.data('boxH') ?? 44) / 2 + 10,
  }
}

/** Angular width a card needs at radius r so neighbors don't collide. */
function atlasArcNeed(r: number, halfA: number, halfB: number, pad: number): number {
  const chord = halfA + halfB + pad
  if (r <= chord * 0.35) return Math.PI / 3
  return 2 * Math.atan(chord / (2 * Math.max(r, 40)))
}

/**
 * Soft AABB separation — pushes overlapping cards/hubs apart until clear.
 * Root stays pinned at origin.
 */
function resolveAtlasCollisions(
  cy: Core,
  ids: string[],
  rootId: string | undefined,
  passes = 48,
  pad = 16,
) {
  const movable = ids.filter((id) => id !== rootId)
  for (let pass = 0; pass < passes; pass++) {
    let moved = 0
    for (let i = 0; i < movable.length; i++) {
      const a = movable[i]!
      const ae = cy.getElementById(a)
      if (ae.empty()) continue
      const ap = ae.position()
      const as = atlasHalfSize(cy, a)
      for (let j = i + 1; j < movable.length; j++) {
        const b = movable[j]!
        const be = cy.getElementById(b)
        if (be.empty()) continue
        const bp = be.position()
        const bs = atlasHalfSize(cy, b)
        const ox = as.hw + bs.hw + pad - Math.abs(ap.x - bp.x)
        const oy = as.hh + bs.hh + pad - Math.abs(ap.y - bp.y)
        if (ox <= 0 || oy <= 0) continue
        // Separate along the shorter overlap axis (stable for cards)
        let dx = bp.x - ap.x
        let dy = bp.y - ap.y
        if (dx === 0 && dy === 0) {
          const jitter = (i + 1) * 0.37
          dx = Math.cos(jitter)
          dy = Math.sin(jitter)
        }
        if (ox < oy) {
          const push = (ox / 2) * (dx >= 0 ? 1 : -1)
          ae.position({ x: ap.x - push, y: ap.y })
          be.position({ x: bp.x + push, y: bp.y })
          ap.x -= push
          bp.x += push
        } else {
          const push = (oy / 2) * (dy >= 0 ? 1 : -1)
          ae.position({ x: ap.x, y: ap.y - push })
          be.position({ x: bp.x, y: bp.y + push })
          ap.y -= push
          bp.y += push
        }
        moved++
      }
      // Keep clear of the root disc
      if (rootId) {
        const rootHalf = atlasHalfSize(cy, rootId)
        const clear = Math.max(rootHalf.hw, rootHalf.hh) + Math.max(as.hw, as.hh) + pad + 12
        const d = Math.hypot(ap.x, ap.y) || 1
        if (d < clear) {
          ae.position({ x: (ap.x / d) * clear, y: (ap.y / d) * clear })
          moved++
        }
      }
    }
    if (!moved) break
  }
}

/**
 * Ontopedian constellation: pie-slice hubs weighted by fan size,
 * multi-arc packing for busy predicates, then collision cleanup.
 */
function placeHopOrbits(cy: Core, data: GraphData) {
  const root =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id
  if (!root) return

  cy.batch(() => {
    const rootNode = cy.getElementById(root)
    if (rootNode.nonempty()) rootNode.position({ x: 0, y: 0 })

    for (let hop = 1; hop <= 5; hop++) {
      const valueR = HOP_RADIUS[hop] ?? 200 + hop * 160
      const hubR = valueR * HUB_RADIUS_FACTOR
      const atHop = data.nodes.filter((n) => (n.__hopDepth ?? 0) === hop)
      const hubs = atHop.filter((n) => n.type === 'relation')
      const values = atHop.filter((n) => n.type !== 'relation')

      const byHub = new Map<string, typeof values>()
      for (const v of values) {
        const key = v.__parentId || v.__clusterKey || '_loose'
        const list = byHub.get(key) ?? []
        list.push(v)
        byHub.set(key, list)
      }

      // Stable order; weight by how many leaves need room in the slice
      const orderedHubs = [...hubs].sort((a, b) => a.label.localeCompare(b.label))
      const loose = byHub.get('_loose') ?? []
      const weights = orderedHubs.map((h) => {
        const kids = byHub.get(h.id) ?? []
        // Busy predicates (subsidiary) earn a wider pie; tiny ones keep a floor
        return Math.max(1.2, Math.sqrt(kids.length + 0.5) + kids.length * 0.4)
      })
      const looseW = loose.length ? Math.max(1.2, Math.sqrt(loose.length) + loose.length * 0.35) : 0
      const totalW = weights.reduce((a, b) => a + b, 0) + looseW || 1

      const hubHalf = 42
      const minHubSlice = atlasArcNeed(hubR, hubHalf, hubHalf, 32)
      const raw = [
        ...weights.map((w) => (w / totalW) * Math.PI * 2),
        ...(looseW ? [(looseW / totalW) * Math.PI * 2] : []),
      ]
      const gated = raw.map((s) => Math.max(s, minHubSlice))
      const gatedSum = gated.reduce((a, b) => a + b, 0) || 1
      const scale = gatedSum > Math.PI * 2 ? (Math.PI * 2) / gatedSum : 1
      const finalSlices = gated.map((s) => s * scale)
      const hubSlices = finalSlices.slice(0, orderedHubs.length)
      const looseSlice = looseW ? finalSlices[finalSlices.length - 1]! : 0

      let cursor = -Math.PI / 2 + (hop % 2 === 0 ? 0.12 : 0)

      const placeFan = (
        kids: GraphNode[],
        midAngle: number,
        slice: number,
        fromR: number,
      ) => {
        if (!kids.length) return
        const sorted = [...kids].sort((a, b) => a.label.localeCompare(b.label))
        const pad = 24
        const halves = sorted.map((k) => atlasHalfSize(cy, k.id))
        const budget = Math.max(0.12, slice * 0.9)

        // Prefer more arcs over crushing cards into one cramped ring
        let arcs = 1
        let baseR = fromR
        for (let tryArcs = 1; tryArcs <= 4; tryArcs++) {
          arcs = tryArcs
          baseR = fromR
          const perArc = Math.ceil(sorted.length / tryArcs)
          let ok = true
          for (let a = 0; a < tryArcs; a++) {
            const start = a * perArc
            const count = Math.min(perArc, sorted.length - start)
            if (count <= 1) continue
            let r = fromR + a * 88
            let need = 0
            for (let i = 1; i < count; i++) {
              need += atlasArcNeed(
                r,
                halves[start + i - 1]!.hw,
                halves[start + i]!.hw,
                pad,
              )
            }
            if (need > budget) {
              // Push this arc out until chords fit the pie slice
              const boost = need / budget
              r = Math.max(r, fromR * Math.min(1.65, 0.85 + boost * 0.45))
              need = 0
              for (let i = 1; i < count; i++) {
                need += atlasArcNeed(
                  r,
                  halves[start + i - 1]!.hw,
                  halves[start + i]!.hw,
                  pad,
                )
              }
              if (need > budget) {
                ok = false
                break
              }
              baseR = Math.max(baseR, r - a * 88)
            }
          }
          if (ok) break
        }

        const perArc = Math.ceil(sorted.length / arcs)
        for (let a = 0; a < arcs; a++) {
          const group = sorted.slice(a * perArc, a * perArc + perArc)
          if (!group.length) continue
          let r = baseR + a * 90
          const gHalves = group.map((k) => atlasHalfSize(cy, k.id))
          const gaps: number[] = []
          for (let i = 1; i < group.length; i++) {
            gaps.push(atlasArcNeed(r, gHalves[i - 1]!.hw, gHalves[i]!.hw, pad))
          }
          let span = gaps.reduce((s, g) => s + g, 0)
          if (span > budget && span > 0) {
            r *= Math.min(1.7, span / budget)
            for (let i = 1; i < group.length; i++) {
              gaps[i - 1] = atlasArcNeed(r, gHalves[i - 1]!.hw, gHalves[i]!.hw, pad)
            }
            span = gaps.reduce((s, g) => s + g, 0)
          }
          const grow = span > 0 && span < budget ? budget / span : 1
          const used = Math.min(budget, Math.max(span * grow, group.length <= 1 ? 0 : span))
          let ang = midAngle - used / 2
          group.forEach((v, i) => {
            if (i > 0) ang += gaps[i - 1]! * (span > 0 && span < budget ? grow : 1)
            const el = cy.getElementById(v.id)
            if (el.empty()) return
            const wobble = group.length > 4 ? (i % 2 === 0 ? 0 : 20) : 0
            el.position({
              x: Math.cos(ang) * (r + wobble),
              y: Math.sin(ang) * (r + wobble),
            })
          })
        }
      }

      orderedHubs.forEach((h, i) => {
        const slice = hubSlices[i] ?? minHubSlice
        const mid = cursor + slice / 2
        const el = cy.getElementById(h.id)
        if (el.nonempty()) {
          el.position({ x: Math.cos(mid) * hubR, y: Math.sin(mid) * hubR })
        }
        placeFan(byHub.get(h.id) ?? [], mid, slice, valueR)
        cursor += slice
      })

      if (loose.length) {
        const mid = cursor + looseSlice / 2
        placeFan(loose, mid, looseSlice, valueR)
      }

      // Snap each hub onto the ray toward its kids' centroid (mid-spoke)
      for (const h of orderedHubs) {
        const kids = byHub.get(h.id) ?? []
        const el = cy.getElementById(h.id)
        if (el.empty()) continue
        if (!kids.length) continue
        let cx = 0
        let cyPos = 0
        let n = 0
        for (const k of kids) {
          const ke = cy.getElementById(k.id)
          if (ke.empty()) continue
          const p = ke.position()
          cx += p.x
          cyPos += p.y
          n++
        }
        if (!n) continue
        cx /= n
        cyPos /= n
        const ang = Math.atan2(cyPos, cx)
        const kidR = Math.hypot(cx, cyPos)
        const spokeR = Math.min(hubR, Math.max(hubR * 0.85, kidR * 0.42))
        el.position({ x: Math.cos(ang) * spokeR, y: Math.sin(ang) * spokeR })
      }
    }

    resolveAtlasCollisions(
      cy,
      data.nodes.map((n) => n.id),
      root,
      56,
      18,
    )

    // After separation, re-seat hubs on the parent→kids spoke so edges stay clean
    for (const h of data.nodes.filter((n) => n.type === 'relation')) {
      const kids = data.nodes.filter(
        (n) => n.type !== 'relation' && (n.__parentId === h.id || n.__clusterKey === h.id),
      )
      const el = cy.getElementById(h.id)
      if (el.empty() || !kids.length) continue
      let cx = 0
      let cyPos = 0
      let n = 0
      for (const k of kids) {
        const ke = cy.getElementById(k.id)
        if (ke.empty()) continue
        const p = ke.position()
        cx += p.x
        cyPos += p.y
        n++
      }
      if (!n) continue
      cx /= n
      cyPos /= n
      const ang = Math.atan2(cyPos, cx)
      const kidR = Math.hypot(cx, cyPos) || 200
      const hop = h.__hopDepth ?? 1
      const base = (HOP_RADIUS[hop] ?? 280) * HUB_RADIUS_FACTOR
      const spokeR = Math.min(Math.max(base, kidR * 0.4), kidR - 70)
      el.position({ x: Math.cos(ang) * spokeR, y: Math.sin(ang) * spokeR })
    }

    // Final light pass — hubs vs cards only
    resolveAtlasCollisions(
      cy,
      data.nodes.map((n) => n.id),
      root,
      24,
      14,
    )
  })
}

function placeOrbitRings(cy: Core, data: GraphData) {
  const buckets = new Map<number, string[]>()
  for (const n of data.nodes) {
    if (n.type === 'relation') continue
    const h = Math.min(5, Math.max(0, n.__hopDepth ?? 0))
    const list = buckets.get(h) ?? []
    list.push(n.id)
    buckets.set(h, list)
  }
  const hubs = data.nodes.filter((n) => n.type === 'relation')
  const root =
    data.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.id ?? data.nodes[0]?.id

  cy.batch(() => {
    for (const [hop, ids] of buckets) {
      const r = HOP_RADIUS[hop] ?? 200 + hop * 160
      const sorted = [...ids].sort()
      // Size-aware equal spacing on the ring
      const halves = sorted.map((id) => atlasHalfSize(cy, id))
      const gaps = sorted.map((_, i) => {
        if (sorted.length < 2) return 0
        const a = halves[i]!
        const b = halves[(i + 1) % sorted.length]!
        return atlasArcNeed(r, a.hw, b.hw, 20)
      })
      const needSum = gaps.reduce((s, g) => s + g, 0)
      const scale = needSum > 0 ? (Math.PI * 2) / needSum : 1
      let ang = -Math.PI / 2
      sorted.forEach((id, i) => {
        const el = cy.getElementById(id)
        if (el.empty()) return
        el.position({ x: Math.cos(ang) * r, y: Math.sin(ang) * r })
        ang += gaps[i]! * scale
      })
    }
    for (const h of hubs) {
      const parent = h.__parentId
      const parentEl = parent ? cy.getElementById(parent) : null
      const hop = h.__hopDepth ?? 1
      const r = (HOP_RADIUS[hop] ?? 280) * HUB_RADIUS_FACTOR
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
    resolveAtlasCollisions(
      cy,
      data.nodes.map((n) => n.id),
      root,
      40,
      16,
    )
  })
}

type KinMaps = ReturnType<typeof buildKinMaps>

/** Approximate person node width for spacing (matches family cards). */
function familyPersonSpan(n: GraphNode, seedId?: string): number {
  const isSeed = n.id === seedId || n.__familyRole === 'seed'
  const hasImage = Boolean(n.__imageUrl)
  if (isSeed && hasImage) return 124
  if (isSeed) return 108
  // Tall rounded-rectangle cards
  return 102
}

const HUB_W = 72
const HUB_H = 24
/** Horizontal air between non-kin neighbors. */
const FAMILY_BREATHE = 40
/** Extra lane so spouse/sibling chips sit between people (mockup style). */
const HUB_LANE = HUB_W + 24

function areSpouses(maps: KinMaps, a: string, b: string): boolean {
  return (maps.spousesOf.get(a) ?? []).includes(b)
}

function areSiblings(maps: KinMaps, a: string, b: string): boolean {
  return (maps.siblingsOf.get(a) ?? []).includes(b)
}

/** Center-to-center gap for two people on the same generation row. */
function familyPairGap(
  maps: KinMaps,
  a: GraphNode,
  b: GraphNode,
  seedId: string | undefined,
): number {
  const radii = familyPersonSpan(a, seedId) / 2 + familyPersonSpan(b, seedId) / 2
  if (areSpouses(maps, a.id, b.id)) return radii + FAMILY_BREATHE + HUB_LANE + 8
  if (areSiblings(maps, a.id, b.id)) return radii + FAMILY_BREATHE + HUB_LANE
  return radii + FAMILY_BREATHE + 28
}

/** Push same-generation people apart; expand from focus both ways. */
function spreadFamilyPeopleRow(
  row: GraphNode[],
  xOf: Map<string, number>,
  maps: KinMaps,
  seedId: string | undefined,
  focusId?: string,
) {
  if (row.length <= 1) return
  const sorted = [...row].sort((a, b) => (xOf.get(a.id) ?? 0) - (xOf.get(b.id) ?? 0))
  const needAt = (i: number) => familyPairGap(maps, sorted[i - 1]!, sorted[i]!, seedId)

  for (let i = 1; i < sorted.length; i++) {
    const need = needAt(i)
    const prevX = xOf.get(sorted[i - 1]!.id)!
    const currX = xOf.get(sorted[i]!.id)!
    if (currX - prevX < need) xOf.set(sorted[i]!.id, prevX + need)
  }
  for (let i = sorted.length - 1; i >= 1; i--) {
    const need = needAt(i)
    const prevX = xOf.get(sorted[i - 1]!.id)!
    const currX = xOf.get(sorted[i]!.id)!
    if (currX - prevX < need) xOf.set(sorted[i - 1]!.id, currX - need)
  }
  const anchorId =
    (focusId && sorted.some((n) => n.id === focusId) ? focusId : null) ??
    sorted[Math.floor(sorted.length / 2)]!.id
  const before = xOf.get(anchorId) ?? 0
  for (let i = 1; i < sorted.length; i++) {
    const need = needAt(i)
    const prevX = xOf.get(sorted[i - 1]!.id)!
    const currX = xOf.get(sorted[i]!.id)!
    if (currX - prevX < need) xOf.set(sorted[i]!.id, prevX + need)
  }
  const drift = (xOf.get(anchorId) ?? 0) - before
  if (Math.abs(drift) > 0.5) {
    for (const n of sorted) xOf.set(n.id, (xOf.get(n.id) ?? 0) - drift)
  }
}

/**
 * Pedigree hubs — positions match the family-tree mockup:
 * - Spouse / Sibling pills sit ON the horizontal bar between people (same Y)
 * - Child / Parents pills sit ON the vertical stem under the couple midpoint
 * - Orthogonal taxi edges then form clean T-junctions
 */
function placeHubsFromMaps(
  cy: Core,
  maps: KinMaps,
  xOf: Map<string, number>,
  yOf: Map<string, number>,
  band: number,
) {
  const { hubs, byId, hubSubject, hubKids, spousesOf, people } = maps
  const hubPos = new Map<string, { x: number; y: number }>()

  const coupleBarX = (subjectId: string, fallback: number): number => {
    const sx = xOf.get(subjectId)
    if (sx == null) return fallback
    const spouseId = (spousesOf.get(subjectId) ?? []).find((id) => xOf.has(id))
    if (!spouseId) return sx
    const spx = xOf.get(spouseId)
    return spx == null ? sx : (sx + spx) / 2
  }

  for (const hub of hubs) {
    const subjectId = hubSubject.get(hub.id) || hub.__parentId || ''
    const kids = hubKids.get(hub.id) ?? []
    const label = (hub.label || '').toLowerCase()
    const isSpouse = label === 'spouse'
    const isSibling = label === 'sibling'
    const sx = subjectId ? xOf.get(subjectId) : undefined
    const sy =
      subjectId !== ''
        ? (yOf.get(subjectId) ?? (byId.get(subjectId)?.__familyGen ?? 0) * band)
        : 0
    const kidXs = kids.map((id) => xOf.get(id)).filter((x): x is number => x != null)
    const kidYs = kids.map(
      (id) => yOf.get(id) ?? (byId.get(id)?.__familyGen ?? 0) * band,
    )

    let x = sx ?? 0
    let y = sy + band * 0.45

    if (kidXs.length) {
      const ax = kidXs.reduce((a, b) => a + b, 0) / kidXs.length
      const ay = kidYs.reduce((a, b) => a + b, 0) / kidYs.length
      const sameRow = Math.abs(ay - sy) < band * 0.3

      if (isSpouse && sameRow && sx != null) {
        // Mockup: purple Spouse pill centered on the marriage bar
        x = (sx + (kidXs[0] ?? ax)) / 2
        y = sy
      } else if (isSibling && sameRow) {
        // Mockup: pink Sibling pill on the horizontal connector (same Y as people)
        const allX = sx != null ? [sx, ...kidXs] : kidXs
        x = allX.reduce((a, b) => a + b, 0) / allX.length
        y = sy
      } else if (subjectId) {
        // Vertical kin: stem under couple bar (Children / Parents / Child / Father…)
        const barX = coupleBarX(subjectId, sx ?? ax)
        const goingDown = ay > sy + band * 0.1
        if (goingDown) {
          // Children pill on the drop from the couple, before the T-junction
          x = barX
          y = sy + (ay - sy) * 0.4
        } else {
          // Parents / father / mother pill on the ascent
          x = (barX + ax) / 2
          y = sy + (ay - sy) * 0.5
        }
      } else {
        x = ax
        y = (sy + ay) / 2
      }
    }

    hubPos.set(hub.id, { x: Math.round(x), y: Math.round(y) })
  }

  // Only nudge hubs that landed inside a person card (keep bar pills on the lane)
  for (const [hubId, pos] of hubPos) {
    const hub = maps.hubs.find((h) => h.id === hubId)
    const label = (hub?.label || '').toLowerCase()
    const onBar = label === 'spouse' || label === 'sibling'
    for (const person of people) {
      const px = xOf.get(person.id)
      const py = yOf.get(person.id)
      if (px == null || py == null) continue
      const minX = familyPersonSpan(person) / 2 + HUB_W / 2 + 10
      const minY = onBar ? 18 : 24 + HUB_H / 2
      if (Math.abs(pos.x - px) < minX && Math.abs(pos.y - py) < minY) {
        // Slide along the bar for spouse/sibling; vertical kin go into the gutter
        if (onBar) pos.x = px + (pos.x >= px ? minX : -minX)
        else pos.y = py + (pos.y >= py ? minY : -minY)
      }
    }
  }

  // De-overlap hubs that share a bar or stem
  const list = [...hubPos.entries()].sort(
    (a, b) => a[1].y - b[1].y || a[1].x - b[1].x,
  )
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]![1]
    const curr = list[i]![1]
    if (Math.abs(curr.y - prev.y) < HUB_H + 6 && curr.x - prev.x < HUB_W + 14) {
      curr.x = prev.x + HUB_W + 14
    }
  }

  for (const [hubId, pos] of hubPos) {
    const el = cy.getElementById(hubId)
    if (!el.empty()) el.position(pos)
  }
}

/**
 * Classic pedigree arrange (matches family-tree mockup):
 * generation rows, couple blocks, children centered under parents, orthogonal edges.
 */
function placeFamilyTree(cy: Core, data: GraphData) {
  const maps = buildKinMaps(data)
  const { people, parentsOf, spousesOf, childrenOf } = maps
  const BAND = 230
  const PAD = FAMILY_BREATHE + 20
  const GAP = 180
  const BRANCH_GAP = 110
  const xOf = new Map<string, number>()
  const yOf = new Map<string, number>()
  const placed = new Set<string>()

  const byGen = new Map<number, GraphNode[]>()
  for (const n of people) {
    const g = n.__familyGen ?? 0
    const list = byGen.get(g) ?? []
    list.push(n)
    byGen.set(g, list)
  }
  const gens = [...byGen.keys()].sort((a, b) => a - b)
  const seed =
    people.find((n) => n.__familyRole === 'seed') ??
    people.find((n) => (n.__familyGen ?? 0) === 0) ??
    people[0]
  const seedId = seed?.id

  const minLeaf = (id: string) => {
    const n = maps.byId.get(id)
    return n ? familyPersonSpan(n, seedId) + PAD + HUB_LANE * 0.25 : GAP
  }

  /** Width of person + same-gen spouses (a couple unit). */
  const coupleWidth = (id: string): number => {
    const node = maps.byId.get(id)
    if (!node) return minLeaf(id)
    const gen = node.__familyGen ?? 0
    const spouses = (spousesOf.get(id) ?? []).filter((s) => {
      const sn = maps.byId.get(s)
      return sn && (sn.__familyGen ?? 0) === gen
    })
    let w = minLeaf(id)
    let prev = node
    for (const s of spouses) {
      const sn = maps.byId.get(s)
      if (!sn) continue
      w += familyPairGap(maps, prev, sn, seedId)
      prev = sn
    }
    return w
  }

  const subtreeWidth = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return coupleWidth(id)
    seen.add(id)
    const kids = childrenOf.get(id) ?? []
    const selfW = coupleWidth(id)
    if (!kids.length) return Math.max(GAP, selfW)
    const kidsSpan =
      kids.reduce((sum, k) => sum + subtreeWidth(k, seen), 0) +
      Math.max(0, kids.length - 1) * BRANCH_GAP
    return Math.max(selfW, kidsSpan)
  }

  const placeDescendants = (id: string, x: number, gen: number, seen: Set<string>) => {
    if (seen.has(id)) return
    seen.add(id)
    const node = maps.byId.get(id)
    if (!node) return

    xOf.set(id, x)
    yOf.set(id, gen * BAND)
    placed.add(id)

    const spouseIds = (spousesOf.get(id) ?? []).filter((s) => {
      const sn = maps.byId.get(s)
      return sn && (sn.__familyGen ?? 0) === gen && !placed.has(s)
    })

    let lastCenter = x
    let lastNode: GraphNode = node
    spouseIds.forEach((sid) => {
      const spouse = maps.byId.get(sid)
      if (!spouse) return
      const sx = lastCenter + familyPairGap(maps, lastNode, spouse, seedId)
      xOf.set(sid, sx)
      yOf.set(sid, gen * BAND)
      placed.add(sid)
      lastCenter = sx
      lastNode = spouse
    })

    const kids = (childrenOf.get(id) ?? []).slice().sort((a, b) => {
      const la = maps.byId.get(a)?.label ?? a
      const lb = maps.byId.get(b)?.label ?? b
      return la.localeCompare(lb)
    })
    if (!kids.length) return

    const widths = kids.map((k) => subtreeWidth(k, new Set()))
    const total =
      widths.reduce((a, b) => a + b, 0) + Math.max(0, kids.length - 1) * BRANCH_GAP
    // Center children under the couple midpoint (mockup T-junction)
    const coupleMid =
      spouseIds.length && xOf.has(spouseIds[0]!)
        ? (x + (xOf.get(spouseIds[0]!) ?? x)) / 2
        : x
    let cursor = coupleMid - total / 2
    kids.forEach((kid, i) => {
      const w = widths[i]!
      placeDescendants(kid, cursor + w / 2, gen + 1, seen)
      cursor += w + BRANCH_GAP
    })
  }

  const placeAncestors = () => {
    const ancestorGens = gens.filter((g) => g < 0).sort((a, b) => b - a)
    for (const gen of ancestorGens) {
      const members = (byGen.get(gen) ?? []).slice().sort((a, b) =>
        a.label.localeCompare(b.label),
      )
      const desired = members.map((m, i) => {
        const kids = (childrenOf.get(m.id) ?? [])
          .map((c) => xOf.get(c))
          .filter((v): v is number => v != null)
        if (kids.length) return kids.reduce((a, b) => a + b, 0) / kids.length
        const childRefs = people.filter((p) => (parentsOf.get(p.id) ?? []).includes(m.id))
        const cxs = childRefs
          .map((c) => xOf.get(c.id))
          .filter((v): v is number => v != null)
        if (cxs.length) return cxs.reduce((a, b) => a + b, 0) / cxs.length
        return i * GAP
      })
      const order = members
        .map((m, i) => ({ m, d: desired[i]! }))
        .sort((a, b) => a.d - b.d)

      let prev: GraphNode | null = null
      let cursor = Number.NEGATIVE_INFINITY
      for (const item of order) {
        if (placed.has(item.m.id)) continue
        let x = item.d
        if (prev && cursor !== Number.NEGATIVE_INFINITY) {
          x = Math.max(item.d, cursor + familyPairGap(maps, prev, item.m, seedId))
        }
        xOf.set(item.m.id, x)
        yOf.set(item.m.id, gen * BAND)
        placed.add(item.m.id)
        cursor = x
        prev = item.m
      }
    }
  }

  if (seed) {
    placeDescendants(seed.id, 0, seed.__familyGen ?? 0, new Set())

    const peers = people.filter(
      (n) =>
        (n.__familyGen ?? 0) === (seed.__familyGen ?? 0) &&
        !placed.has(n.id) &&
        (n.__familyRole === 'sibling' || n.__familyRole === 'spouse'),
    )
    const leftSibs = peers
      .filter((s) => s.__familyRole !== 'spouse')
      .sort((a, b) => a.label.localeCompare(b.label))
    const rightSibs = peers
      .filter((s) => s.__familyRole === 'spouse')
      .sort((a, b) => a.label.localeCompare(b.label))

    let anchor: GraphNode = seed
    let anchorX = xOf.get(seed.id) ?? 0
    for (const sib of [...leftSibs].reverse()) {
      const x = anchorX - familyPairGap(maps, sib, anchor, seedId)
      placeDescendants(sib.id, x, seed.__familyGen ?? 0, new Set())
      anchor = sib
      anchorX = xOf.get(sib.id) ?? x
    }

    anchor = seed
    anchorX = xOf.get(seed.id) ?? 0
    for (const sib of rightSibs) {
      const x = anchorX + familyPairGap(maps, anchor, sib, seedId)
      xOf.set(sib.id, x)
      yOf.set(sib.id, (seed.__familyGen ?? 0) * BAND)
      placed.add(sib.id)
      anchor = sib
      anchorX = x
    }
  }

  placeAncestors()

  // Leftovers: append to the right of their generation
  for (const gen of gens) {
    const leftover = (byGen.get(gen) ?? []).filter((n) => !placed.has(n.id))
    if (!leftover.length) continue
    leftover.sort((a, b) => a.label.localeCompare(b.label))
    const placedInGen = (byGen.get(gen) ?? []).filter((n) => xOf.has(n.id))
    let prev: GraphNode | null =
      placedInGen.length > 0
        ? placedInGen.reduce((a, b) =>
            (xOf.get(a.id) ?? 0) >= (xOf.get(b.id) ?? 0) ? a : b,
          )
        : null
    let cursor = prev ? (xOf.get(prev.id) ?? 0) : Number.NEGATIVE_INFINITY
    for (const m of leftover) {
      const x =
        prev == null || cursor === Number.NEGATIVE_INFINITY
          ? 0
          : cursor + familyPairGap(maps, prev, m, seedId)
      xOf.set(m.id, x)
      yOf.set(m.id, gen * BAND)
      placed.add(m.id)
      cursor = x
      prev = m
    }
  }

  // Tidy: for each parent, shift their children’s block so its midpoint sits under the couple
  for (const parent of people) {
    const kids = (childrenOf.get(parent.id) ?? []).filter((id) => xOf.has(id))
    if (kids.length < 1) continue
    const px = xOf.get(parent.id)
    if (px == null) continue
    const spouses = (spousesOf.get(parent.id) ?? []).filter((s) => xOf.has(s))
    const coupleMid =
      spouses.length && xOf.has(spouses[0]!)
        ? (px + (xOf.get(spouses[0]!) ?? px)) / 2
        : px
    const kidXs = kids.map((id) => xOf.get(id)!)
    const blockMid = (Math.min(...kidXs) + Math.max(...kidXs)) / 2
    const shift = coupleMid - blockMid
    if (Math.abs(shift) < 1) continue

    const shiftSubtree = (id: string, visited: Set<string>) => {
      if (visited.has(id) || !xOf.has(id)) return
      visited.add(id)
      xOf.set(id, (xOf.get(id) ?? 0) + shift)
      for (const s of spousesOf.get(id) ?? []) {
        if (xOf.has(s) && !visited.has(s)) {
          xOf.set(s, (xOf.get(s) ?? 0) + shift)
          visited.add(s)
        }
      }
      for (const k of childrenOf.get(id) ?? []) shiftSubtree(k, visited)
    }
    const visited = new Set<string>()
    for (const k of kids) shiftSubtree(k, visited)
  }

  for (let pass = 0; pass < 4; pass++) {
    for (const gen of gens) {
      const row = (byGen.get(gen) ?? []).filter((n) => xOf.has(n.id))
      spreadFamilyPeopleRow(row, xOf, maps, seedId, seedId)
    }
  }

  const focusX = seed ? (xOf.get(seed.id) ?? 0) : 0
  for (const [id, x] of [...xOf.entries()]) xOf.set(id, x - focusX)

  cy.batch(() => {
    for (const n of people) {
      const el = cy.getElementById(n.id)
      if (el.empty()) continue
      el.position({
        x: xOf.get(n.id) ?? 0,
        y: yOf.get(n.id) ?? (n.__familyGen ?? 0) * BAND,
      })
    }
    placeHubsFromMaps(cy, maps, xOf, yOf, BAND)
  })
}

function fitAfter(cy: Core) {
  cy.stop()
  cy.fit(undefined, 72)
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

  if (mode === 'family' || mode === 'family-cascade' || mode === 'family-tree') {
    cy.edges().removeClass('tree-trunk')
    placeFamilyTree(cy, data)
    cy.edges('.kin-edge').addClass('tree-trunk')
    // Fit after positions settle
    requestAnimationFrame(() => fitAfter(cy))
    return
  }

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
      const bump = selected ? 10 : onPath ? 4 : 0
      const next: Record<string, string | number> = {
        width: boxW + bump,
        height: boxH + bump * 0.35,
        'background-color': node.data('fill'),
        'border-color': selected || onPath ? '#c07818' : node.data('border'),
        'border-width': selected ? 4 : onPath ? 3 : 2,
        color: node.data('textColor'),
        'text-max-width': Number(node.data('textMax') ?? boxW - 14),
        'underlay-color': '#c07818',
        'underlay-padding': selected ? 10 : 0,
        'underlay-opacity': selected ? 0.28 : 0,
        'shadow-blur': selected ? 18 : 0,
        'shadow-color': 'rgba(192, 120, 24, 0.45)',
        'shadow-opacity': selected ? 0.85 : 0,
        'shadow-offset-x': 0,
        'shadow-offset-y': selected ? 2 : 0,
      }
      const img = String(node.data('imageUrl') || '')
      if (img) {
        next['background-image'] = img
        next['background-image-crossorigin'] = 'anonymous'
        next['background-fit'] = 'cover'
        next['background-clip'] = 'node'
      }
      node.style(next)
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
          'target-arrow-shape': 'triangle',
          'arrow-scale': edge.hasClass('hub-edge') ? 1.05 : 1.15,
        })
      }
    })
  })
}

export const KnowledgeGraph = forwardRef<KnowledgeGraphHandle, Props>(
  function KnowledgeGraph(
    {
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
      onExpandFamily,
      onBackgroundClick,
    },
    ref,
  ) {
    const wrapRef = useRef<HTMLDivElement>(null)
    const cyRef = useRef<Core | null>(null)
    const onNodeClickRef = useRef(onNodeClick)
    const onNodeExpandRef = useRef(onNodeExpand)
    const onExpandFamilyRef = useRef(onExpandFamily)
    const onBgRef = useRef(onBackgroundClick)
    const rawMap = useRef(new Map<string, GraphNode>())
    const lastSig = useRef('')
    const layoutModeRef = useRef(layoutMode)
    const dataRef = useRef(data)
    const selectedRef = useRef(selectedNodeId)
    const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(
      null,
    )
    const [familyHover, setFamilyHover] = useState<{
      node: GraphNode
      x: number
      y: number
    } | null>(null)
    layoutModeRef.current = layoutMode
    dataRef.current = data
    selectedRef.current = selectedNodeId
    onNodeClickRef.current = onNodeClick
    onNodeExpandRef.current = onNodeExpand
    onExpandFamilyRef.current = onExpandFamily
    onBgRef.current = onBackgroundClick

    const clearFamilyHoverSoon = () => {
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
      hoverLeaveTimer.current = setTimeout(() => setFamilyHover(null), 280)
    }
    const keepFamilyHover = () => {
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
    }

    useImperativeHandle(ref, () => ({
      exportImage: async (format: 'png' | 'jpg') => {
        const cy = cyRef.current
        if (!cy || cy.nodes().length === 0) return
        // Fit content so the export isn’t a cropped viewport snapshot
        cy.stop()
        cy.fit(undefined, 48)
        const opts = {
          output: 'blob-promise' as const,
          bg: '#fffdf8',
          full: true,
          scale: 2,
          maxWidth: 5120,
          maxHeight: 5120,
        }
        try {
          const blob =
            format === 'jpg'
              ? ((await cy.jpg({ ...opts, quality: 0.92 })) as Blob)
              : ((await cy.png(opts)) as Blob)
          const root =
            dataRef.current.nodes.find((n) => (n.__hopDepth ?? 0) === 0)?.label ||
            dataRef.current.nodes.find((n) => n.__familyRole === 'seed')?.label ||
            'ontopedian-graph'
          const safe = root.replace(/[^\w\-]+/g, '_').slice(0, 48) || 'ontopedian-graph'
          const stamp = new Date().toISOString().slice(0, 10)
          downloadBlob(blob, `${safe}_${stamp}.${format === 'jpg' ? 'jpg' : 'png'}`)
        } catch (err) {
          console.error('Graph image export failed', err)
        }
      },
    }))

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
        const raw = rawMap.current.get(evt.target.id())
        const full = String(evt.target.data('fullLabel') || '')
        const subtitle = String(evt.target.data('subtitle') || '')
        const kind = String(evt.target.data('kind') || '')
        const hop = evt.target.data('hopDepth')
        const pos = evt.renderedPosition || evt.target.renderedPosition()
        setTip({
          text: [
            full,
            subtitle || KIND_STYLE[kind as keyof typeof KIND_STYLE]?.label,
            `hop ${hop}`,
          ]
            .filter(Boolean)
            .join('\n'),
          x: pos.x,
          y: pos.y,
        })
        if (
          raw &&
          raw.type === 'resource' &&
          !raw.id.startsWith('relhub:') &&
          (kind === 'person' ||
            raw.__familyRole ||
            raw.classes?.some((c) => /human|person/i.test(c)))
        ) {
          keepFamilyHover()
          setFamilyHover({ node: raw, x: pos.x, y: pos.y - 42 })
        } else {
          setFamilyHover(null)
        }
      })
      cy.on('mouseover', 'edge', (evt) => {
        const full = String(evt.target.data('fullLabel') || '')
        const flow = String(evt.target.data('flow') || 'out')
        const pos = evt.renderedPosition || evt.target.midpoint()
        setTip({
          text: `${full || 'related'}\n${flow === 'in' ? '← incoming' : 'source → destination'}`,
          x: pos.x,
          y: pos.y,
        })
      })
      cy.on('mouseout', 'node, edge', () => {
        setTip(null)
        clearFamilyHoverSoon()
      })
      cy.on('viewport', () => {
        setTip(null)
        setFamilyHover(null)
      })
      cy.on('tap', (evt) => {
        if (evt.target === cy) onBgRef.current?.()
      })

      return () => {
        if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
        cy.destroy()
        cyRef.current = null
      }
    }, [])

    useEffect(() => {
      const cy = cyRef.current
      if (!cy) return
      rawMap.current = new Map(data.nodes.map((n) => [n.id, n]))
      const sig = `${graphEpoch}|${data.nodes
        .map((n) => `${n.id}:${n.__imageUrl || ''}`)
        .sort()
        .join(',')}|${data.links
        .map((l) => l.id)
        .sort()
        .join(',')}`
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
      cy.stop()
      cy.batch(() => {
        cy.elements().remove()
        cy.add(buildElements(dataRef.current))
      })
      runLayout(cy, dataRef.current, selectedRef.current, layoutMode)
    }, [layoutMode, layoutKey])

    useEffect(() => {
      if (fitKey === 0) return
      const cy = cyRef.current
      if (!cy) return
      cy.resize()
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
    const portrait = focus?.node.__imageUrl

    return (
      <div className={`graph-stage atlas ${isFamilyLayout(layoutMode) ? 'is-family' : ''}`}>
        <div className={`graph-atmosphere fact-field mode-${layoutMode}`} aria-hidden />
        {!isFamilyLayout(layoutMode) && (
          <div className="graph-constellation" aria-hidden>
            <span className="orbit-ring r1" />
            <span className="orbit-ring r2" />
            <span className="orbit-ring r3" />
          </div>
        )}
        {isFamilyLayout(layoutMode) && (
          <div className="family-tree-silhouette" aria-hidden>
            <span className="fts-canopy" />
            <span className="fts-trunk" />
            <span className="fts-root" />
          </div>
        )}
        {isFamilyLayout(layoutMode) && (
          <div className="family-pedigree-legend" aria-label="Family relations">
            <span className="fpl-item vertical">Person → relation hub → relative</span>
            <span className="fpl-item father">Father / Mother</span>
            <span className="fpl-item mother">Child</span>
            <span className="fpl-item lateral">Spouse / Sibling</span>
          </div>
        )}
        {layoutMode === 'family-tree' && (
          <div className="family-gen-ribbons" aria-hidden>
            <span className="fgr up">Ancestors</span>
            <span className="fgr mid">Focus lineage</span>
            <span className="fgr down">Descendants</span>
          </div>
        )}
        <div className="cy-host" ref={wrapRef} />

        {focus && (
          <aside className="graph-focus" aria-live="polite">
            {portrait && (
              <div className="graph-focus-portrait">
                <img src={portrait} alt="" loading="lazy" />
              </div>
            )}
            <div className="graph-focus-copy">
              <p className="graph-focus-kicker">
                {focus.node.type === 'relation'
                  ? `${focus.node.__direction === 'in' ? 'Incoming' : 'Outgoing'} link`
                  : kindLabel}
                {' · '}
                {focus.hop === 0 ? 'focus' : `${focus.hop} step${focus.hop === 1 ? '' : 's'}`}
              </p>
              <h3 className="graph-focus-title">{focus.node.label}</h3>
              <p className="graph-focus-meta">
                {focus.node.type === 'relation'
                  ? `${focus.kids} connected`
                  : focus.node.classes?.length
                    ? focus.node.classes.slice(0, 3).join(' · ')
                    : kindLabel}
                {focus.node.type !== 'relation' ? ` · ${focus.deg} links` : ''}
              </p>
            </div>
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

        {familyHover && onExpandFamily && (
          <button
            type="button"
            className="family-expand-float"
            style={{ left: familyHover.x, top: familyHover.y }}
            onMouseEnter={keepFamilyHover}
            onMouseLeave={clearFamilyHoverSoon}
            onClick={(e) => {
              e.stopPropagation()
              const n = familyHover.node
              setFamilyHover(null)
              onExpandFamilyRef.current?.(n)
            }}
          >
            Expand family tree
          </button>
        )}

        {data.nodes.length > 0 && showLegend && <GraphLegend />}
        {data.nodes.length > 0 && !focus && (
          <div className="graph-hint">
            Ontopedian atlas · hover a person to expand kinship · child links share one hub
          </div>
        )}
      </div>
    )
  },
)
