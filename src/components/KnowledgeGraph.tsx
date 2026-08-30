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
    const hasImage = Boolean(n.__imageUrl && (isRoot || n.type === 'resource'))
    const card = informativeCard(n, {
      root: isRoot,
      degree: degrees.get(n.id) ?? 0,
      childCount: children.get(n.id) ?? 0,
    })
    const shape = atlasShape(n, isRoot)
    const boxW = isRoot
      ? hasImage
        ? 124
        : Math.max(card.width, 118)
      : n.type === 'relation'
        ? card.width
        : card.kind === 'person'
          ? Math.max(card.width, 96)
          : card.width
    const boxH = isRoot
      ? hasImage
        ? 124
        : 62
      : n.type === 'relation'
        ? 28
        : card.kind === 'person'
          ? Math.max(card.height, 52)
          : card.height

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
        boxW,
        boxH,
        textMax: card.textMax,
        clusterKey: n.__clusterKey ?? '',
        parentId: n.__parentId ?? '',
        fill: colors.fill,
        border: colors.border,
        textColor: colors.text,
        imageUrl: n.__imageUrl ?? '',
        atlasShape: shape,
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
        isRoot ? 'is-root' : '',
        hasImage ? 'has-image' : '',
        `shape-${card.kind}`,
      ]
        .filter(Boolean)
        .join(' '),
      style: {
        width: boxW,
        height: boxH,
        'background-color': colors.fill,
        'border-color': colors.border,
        color: colors.text,
        shape,
        'text-max-width': card.textMax,
        ...(hasImage
          ? {
              'background-image': n.__imageUrl,
              'background-image-crossorigin': 'anonymous',
              'background-fit': 'cover',
              'background-clip': 'node',
              'background-image-opacity': 1,
              'background-position-y': '0%',
              'background-height': isRoot ? '72%' : '100%',
              'background-width': '100%',
              'text-valign': isRoot ? 'bottom' : 'center',
              'text-margin-y': isRoot ? 8 : 0,
              'text-background-color': '#ffffff',
              'text-background-opacity': isRoot ? 0.92 : 0,
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
    const hubEdge =
      srcNode?.type === 'relation' || tgtNode?.type === 'relation'
    const kinEdge = source.startsWith('relhub:') || target.startsWith('relhub:')
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
      'letter-spacing': 0.4,
      'text-transform': 'lowercase',
      'border-width': 1.6,
      'border-color': '#0d7a72',
      'background-color': '#e8f6f4',
      color: '#0a3d3a',
      shape: 'round-rectangle',
      width: 72,
      height: 26,
      'z-index': 12,
      'shadow-blur': 10,
      'shadow-color': 'rgba(13, 122, 114, 0.28)',
      'shadow-opacity': 0.8,
    },
  },
  {
    selector: 'edge.kin-edge',
    style: {
      width: 1.65,
      'curve-style': 'bezier',
      'control-point-step-size': 36,
      'target-arrow-shape': 'none',
      label: '',
      opacity: 0.72,
      'line-color': 'rgba(13, 122, 114, 0.55)',
    },
  },
  {
    selector: 'edge.kin-edge.tree-trunk',
    style: {
      width: 2.1,
      'curve-style': 'taxi',
      'taxi-direction': 'vertical',
      'taxi-turn': 42,
      'taxi-turn-min-distance': 18,
      opacity: 0.8,
      'line-color': 'rgba(10, 90, 84, 0.62)',
    },
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

/** Ontopedian constellation: hubs as petals, values fanned along each spoke. */
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
        const n = Math.max(hubs.length, 1)
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2 + (hop % 2 === 0 ? 0.22 : 0)
        const wobble = 1 + 0.06 * Math.sin(i * 1.7 + hop)
        const el = cy.getElementById(h.id)
        if (el.empty()) return
        el.position({
          x: Math.cos(angle) * hubR * wobble,
          y: Math.sin(angle) * hubR * wobble,
        })
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
        const hubPos = hubEl.nonempty() ? hubEl.position() : { x: 0, y: -hubR }
        const baseAngle = Math.atan2(hubPos.y, hubPos.x)
        const dist = Math.max(92, valueR - hubR)
        kids.forEach((v, i) => {
          const spread = (i - (kids.length - 1) / 2) * 0.32
          const r = dist * (0.92 + (i % 3) * 0.08)
          const el = cy.getElementById(v.id)
          if (el.empty()) return
          el.position({
            x: hubPos.x + Math.cos(baseAngle + spread) * r,
            y: hubPos.y + Math.sin(baseAngle + spread) * r,
          })
        })
      }
    }
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

function placeFamilyPedigree(cy: Core, data: GraphData) {
  const people = data.nodes.filter((n) => n.type !== 'relation' && n.type !== 'literal')
  const hubs = data.nodes.filter((n) => n.type === 'relation')
  const byGen = new Map<number, GraphNode[]>()
  for (const n of people) {
    const g = n.__familyGen ?? 0
    const list = byGen.get(g) ?? []
    list.push(n)
    byGen.set(g, list)
  }

  const roleRank = (role?: GraphNode['__familyRole']) => {
    if (role === 'seed') return 0
    if (role === 'spouse') return 1
    if (role === 'sibling') return 2
    if (role === 'parent') return 3
    if (role === 'child') return 4
    return 5
  }

  const parentBias = (n: GraphNode) => {
    const blob = `${n.label} ${n.classes?.join(' ') ?? ''}`.toLowerCase()
    if (/\bmother\b|female/.test(blob) || n.__familyRole === 'parent') return 0
    return 1
  }

  const BAND = 188
  const GAP = 128
  const pos = new Map<string, { x: number; y: number }>()

  cy.batch(() => {
    for (const [gen, members] of byGen) {
      members.sort((a, b) => {
        const ra = roleRank(a.__familyRole)
        const rb = roleRank(b.__familyRole)
        if (ra !== rb) return ra - rb
        if (gen !== 0 && a.__familyRole === 'parent' && b.__familyRole === 'parent') {
          const pb = parentBias(a) - parentBias(b)
          if (pb !== 0) return pb
        }
        return a.label.localeCompare(b.label)
      })

      if (gen === 0) {
        const seed = members.find((m) => m.__familyRole === 'seed') ?? members[0]
        const spouses = members.filter((m) => m.__familyRole === 'spouse')
        const siblings = members.filter(
          (m) => m.id !== seed?.id && m.__familyRole === 'sibling',
        )
        const rest = members.filter(
          (m) =>
            m.id !== seed?.id &&
            m.__familyRole !== 'spouse' &&
            m.__familyRole !== 'sibling',
        )
        const ordered: GraphNode[] = [
          ...siblings.slice(0, Math.ceil(siblings.length / 2)),
          ...(seed ? [seed] : []),
          ...spouses,
          ...rest,
          ...siblings.slice(Math.ceil(siblings.length / 2)),
        ]
        const totalW = Math.max(0, ordered.length - 1) * GAP
        ordered.forEach((m, i) => {
          const x = -totalW / 2 + i * GAP
          const y = gen * BAND
          pos.set(m.id, { x, y })
          const el = cy.getElementById(m.id)
          if (!el.empty()) el.position({ x, y })
        })
        continue
      }

      const totalW = Math.max(0, members.length - 1) * GAP
      members.forEach((m, i) => {
        const x = -totalW / 2 + i * GAP
        const y = gen * BAND
        pos.set(m.id, { x, y })
        const el = cy.getElementById(m.id)
        if (!el.empty()) el.position({ x, y })
      })
    }

    // Kinship hubs sit mid-band between subject and their values
    const hubKids = new Map<string, string[]>()
    const hubSubject = new Map<string, string>()
    for (const l of data.links) {
      const { source, target } = linkEnds(l)
      if (source.startsWith('relhub:')) {
        const kids = hubKids.get(source) ?? []
        if (!kids.includes(target)) kids.push(target)
        hubKids.set(source, kids)
      } else if (target.startsWith('relhub:')) {
        hubSubject.set(target, source)
      }
    }

    for (const hub of hubs) {
      const subjectId = hubSubject.get(hub.id) || hub.__parentId
      const kids = hubKids.get(hub.id) ?? []
      const subj = subjectId ? pos.get(subjectId) : undefined
      const kidPts = kids.map((id) => pos.get(id)).filter(Boolean) as {
        x: number
        y: number
      }[]
      let x = 0
      let y = 0
      if (subj && kidPts.length) {
        const avgX = kidPts.reduce((a, p) => a + p.x, 0) / kidPts.length
        const avgY = kidPts.reduce((a, p) => a + p.y, 0) / kidPts.length
        x = (subj.x + avgX) / 2
        y = (subj.y + avgY) / 2
        // Slight fan so multiple hubs from one person don't stack
        const wobble =
          ((hub.label?.charCodeAt(0) || 0) % 5) * 10 - 20
        x += wobble
      } else if (subj) {
        x = subj.x
        y = subj.y + BAND * 0.42
      } else if (kidPts.length) {
        x = kidPts.reduce((a, p) => a + p.x, 0) / kidPts.length
        y = kidPts.reduce((a, p) => a + p.y, 0) / kidPts.length - BAND * 0.42
      }
      const el = cy.getElementById(hub.id)
      if (!el.empty()) el.position({ x, y })
    }
  })
}

type KinMaps = {
  people: GraphNode[]
  hubs: GraphNode[]
  byId: Map<string, GraphNode>
  childrenOf: Map<string, string[]>
  parentsOf: Map<string, string[]>
  spousesOf: Map<string, string[]>
  hubSubject: Map<string, string>
  hubKids: Map<string, string[]>
}

function buildKinMaps(data: GraphData): KinMaps {
  const people = data.nodes.filter((n) => n.type !== 'relation' && n.type !== 'literal')
  const hubs = data.nodes.filter((n) => n.type === 'relation')
  const byId = new Map(people.map((n) => [n.id, n]))
  const childrenOf = new Map<string, string[]>()
  const parentsOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()
  const hubSubject = new Map<string, string>()
  const hubKids = new Map<string, string[]>()

  const push = (map: Map<string, string[]>, key: string, val: string) => {
    const list = map.get(key) ?? []
    if (!list.includes(val)) list.push(val)
    map.set(key, list)
  }

  for (const l of data.links) {
    const { source, target } = linkEnds(l)
    if (source.startsWith('relhub:') && byId.has(target)) {
      push(hubKids, source, target)
    } else if (byId.has(source) && target.startsWith('relhub:')) {
      hubSubject.set(target, source)
    }
  }

  for (const [hubId, subject] of hubSubject) {
    const kids = hubKids.get(hubId) ?? []
    const pred = (hubId.split(':')[2] || '').toLowerCase()
    const isChild = pred.includes('p40')
    const isSpouse = pred.includes('p26') || pred.includes('spouse')
    const isParent =
      pred.includes('p22') ||
      pred.includes('p25') ||
      pred === 'parents' ||
      hubId.includes(':parents:')
    for (const t of kids) {
      if (!byId.has(t)) continue
      if (isChild) {
        push(childrenOf, subject, t)
        push(parentsOf, t, subject)
      } else if (isParent) {
        push(parentsOf, subject, t)
        push(childrenOf, t, subject)
      } else if (isSpouse) {
        push(spousesOf, subject, t)
        push(spousesOf, t, subject)
      }
    }
  }

  // Legacy direct person↔person edges (if any remain)
  for (const l of data.links) {
    const { source, target } = linkEnds(l)
    if (!byId.has(source) || !byId.has(target)) continue
    const pred = (l.predicate || '').toLowerCase()
    const label = (l.predicateLabel || '').toLowerCase()
    const isChild = /\/p40$|child/.test(pred) || label.includes('child')
    const isSpouse = /\/p26$|spouse|partner|married/.test(pred) || /spouse|partner/.test(label)
    const isParent =
      /\/p22$|\/p25$|father|mother|parents/.test(pred) ||
      /father|mother|parents/.test(label)
    if (isChild) {
      push(childrenOf, source, target)
      push(parentsOf, target, source)
    } else if (isParent) {
      push(parentsOf, source, target)
      push(childrenOf, target, source)
    } else if (isSpouse) {
      push(spousesOf, source, target)
      push(spousesOf, target, source)
    }
  }

  return {
    people,
    hubs,
    byId,
    childrenOf,
    parentsOf,
    spousesOf,
    hubSubject,
    hubKids,
  }
}

function placeHubsFromMaps(
  cy: Core,
  maps: KinMaps,
  xOf: Map<string, number>,
  yOf: Map<string, number>,
  band: number,
) {
  const { hubs, byId, hubSubject, hubKids } = maps
  for (const hub of hubs) {
    const subjectId = hubSubject.get(hub.id) || hub.__parentId
    const kids = hubKids.get(hub.id) ?? []
    const sx = subjectId ? xOf.get(subjectId) : undefined
    const sy =
      subjectId != null
        ? (yOf.get(subjectId) ?? (byId.get(subjectId)?.__familyGen ?? 0) * band)
        : 0
    const kidXs = kids.map((id) => xOf.get(id)).filter((x): x is number => x != null)
    const kidYs = kids.map(
      (id) => yOf.get(id) ?? (byId.get(id)?.__familyGen ?? 0) * band,
    )
    let x = sx ?? 0
    let y = sy + band * 0.42
    if (kidXs.length) {
      const ax = kidXs.reduce((a, b) => a + b, 0) / kidXs.length
      const ay = kidYs.reduce((a, b) => a + b, 0) / kidYs.length
      x = sx != null ? (sx + ax) / 2 : ax
      y = (sy + ay) / 2
    }
    const el = cy.getElementById(hub.id)
    if (!el.empty()) el.position({ x, y })
  }
}

/**
 * Cascade family arrange: generations as rows; children under parent midpoints.
 * Resolves person→hub→person kinship links.
 */
function placeFamilyCascade(cy: Core, data: GraphData) {
  const maps = buildKinMaps(data)
  const { people, parentsOf } = maps
  const byGen = new Map<number, GraphNode[]>()
  for (const n of people) {
    const g = n.__familyGen ?? 0
    const list = byGen.get(g) ?? []
    list.push(n)
    byGen.set(g, list)
  }

  const gens = [...byGen.keys()].sort((a, b) => a - b)
  const BAND = 190
  const GAP = 118
  const xOf = new Map<string, number>()
  const yOf = new Map<string, number>()

  for (const gen of gens) {
    const members = (byGen.get(gen) ?? []).slice().sort((a, b) => {
      if (a.__familyRole === 'seed') return -1
      if (b.__familyRole === 'seed') return 1
      return a.label.localeCompare(b.label)
    })

    const desired = members.map((m, i) => {
      const ps = (parentsOf.get(m.id) ?? [])
        .map((p) => xOf.get(p))
        .filter((x): x is number => x != null)
      if (ps.length) return ps.reduce((a, b) => a + b, 0) / ps.length
      return i * GAP
    })

    const order = members
      .map((m, i) => ({ m, d: desired[i]! }))
      .sort((a, b) => a.d - b.d)

    let cursor = 0
    order.forEach((item, idx) => {
      const target = idx === 0 ? item.d : Math.max(item.d, cursor + GAP)
      xOf.set(item.m.id, target)
      cursor = target
    })

    const xs = order.map((o) => xOf.get(o.m.id)!)
    if (xs.length) {
      const mid = (Math.min(...xs) + Math.max(...xs)) / 2
      for (const o of order) {
        xOf.set(o.m.id, xOf.get(o.m.id)! - mid)
      }
    }
  }

  cy.batch(() => {
    for (const n of people) {
      const el = cy.getElementById(n.id)
      if (el.empty()) continue
      const gen = n.__familyGen ?? 0
      const x = xOf.get(n.id) ?? 0
      const y = gen * BAND
      yOf.set(n.id, y)
      el.position({ x, y })
    }
    placeHubsFromMaps(cy, maps, xOf, yOf, BAND)
  })
}

/**
 * Classic vertical family tree: ancestors rise above the focus couple,
 * descendants fan under parent midpoints — a readable pedigree silhouette.
 */
function placeFamilyTree(cy: Core, data: GraphData) {
  const maps = buildKinMaps(data)
  const { people, parentsOf, spousesOf, childrenOf } = maps
  const BAND = 220
  const GAP = 140
  const COUPLE = 108
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

  const subtreeWidth = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return GAP
    seen.add(id)
    const kids = childrenOf.get(id) ?? []
    if (!kids.length) return GAP
    return Math.max(
      GAP,
      kids.reduce((sum, k) => sum + subtreeWidth(k, seen), 0),
    )
  }

  const placeDescendants = (id: string, x: number, gen: number, seen: Set<string>) => {
    if (seen.has(id)) return
    seen.add(id)
    xOf.set(id, x)
    yOf.set(id, gen * BAND)
    placed.add(id)

    const spouseIds = (spousesOf.get(id) ?? []).filter((s) => {
      const sn = maps.byId.get(s)
      return sn && (sn.__familyGen ?? 0) === gen && !placed.has(s)
    })
    spouseIds.forEach((sid, i) => {
      const sx = x + COUPLE * (i + 1)
      xOf.set(sid, sx)
      yOf.set(sid, gen * BAND + 8)
      placed.add(sid)
    })

    const kids = (childrenOf.get(id) ?? []).slice().sort((a, b) => {
      const la = maps.byId.get(a)?.label ?? a
      const lb = maps.byId.get(b)?.label ?? b
      return la.localeCompare(lb)
    })
    if (!kids.length) return

    const widths = kids.map((k) => subtreeWidth(k, new Set()))
    const total = widths.reduce((a, b) => a + b, 0)
    let cursor = x - total / 2
    // Fan from couple midpoint when spouse present
    const coupleMid =
      spouseIds.length && xOf.has(spouseIds[0]!)
        ? (x + (xOf.get(spouseIds[0]!) ?? x)) / 2
        : x
    cursor = coupleMid - total / 2

    kids.forEach((kid, i) => {
      const w = widths[i]!
      const kx = cursor + w / 2
      cursor += w
      placeDescendants(kid, kx, gen + 1, seen)
    })
  }

  // Ancestors: walk upward generation by generation under child midpoints (reversed)
  const placeAncestors = () => {
    const ancestorGens = gens.filter((g) => g < 0).sort((a, b) => b - a) // -1, -2, …
    // First place gen -1 relative to seed, then walk up
    for (const gen of ancestorGens) {
      const members = (byGen.get(gen) ?? []).slice().sort((a, b) =>
        a.label.localeCompare(b.label),
      )
      const desired = members.map((m, i) => {
        const kids = (childrenOf.get(m.id) ?? [])
          .map((c) => xOf.get(c))
          .filter((x): x is number => x != null)
        if (kids.length) return kids.reduce((a, b) => a + b, 0) / kids.length
        const childRefs = people.filter((p) => (parentsOf.get(p.id) ?? []).includes(m.id))
        const cxs = childRefs
          .map((c) => xOf.get(c.id))
          .filter((x): x is number => x != null)
        if (cxs.length) return cxs.reduce((a, b) => a + b, 0) / cxs.length
        return i * GAP
      })
      const order = members
        .map((m, i) => ({ m, d: desired[i]! }))
        .sort((a, b) => a.d - b.d)
      let cursor = Number.NEGATIVE_INFINITY
      for (const item of order) {
        if (placed.has(item.m.id)) continue
        const x = cursor === Number.NEGATIVE_INFINITY ? item.d : Math.max(item.d, cursor + GAP)
        xOf.set(item.m.id, x)
        // Slight arch so ancestor row feels like a canopy
        const arch = Math.sin(x / 280) * 12
        yOf.set(item.m.id, gen * BAND + arch)
        placed.add(item.m.id)
        cursor = x
      }
    }
  }

  if (seed) {
    placeDescendants(seed.id, 0, seed.__familyGen ?? 0, new Set())
    // Siblings of seed at gen 0 who weren't placed via spouse/child
    const siblings = people.filter(
      (n) =>
        (n.__familyGen ?? 0) === (seed.__familyGen ?? 0) &&
        !placed.has(n.id) &&
        (n.__familyRole === 'sibling' || n.__familyRole === 'spouse'),
    )
    let left = -GAP
    let right = COUPLE + GAP
    for (const sib of siblings.sort((a, b) => a.label.localeCompare(b.label))) {
      if (sib.__familyRole === 'spouse') {
        xOf.set(sib.id, right)
        yOf.set(sib.id, (seed.__familyGen ?? 0) * BAND + 8)
        right += COUPLE
      } else {
        xOf.set(sib.id, left)
        yOf.set(sib.id, (seed.__familyGen ?? 0) * BAND)
        left -= GAP
      }
      placed.add(sib.id)
    }
  }

  placeAncestors()

  // Anyone still unplaced — fall back to gen band centered layout
  for (const gen of gens) {
    const leftover = (byGen.get(gen) ?? []).filter((n) => !placed.has(n.id))
    if (!leftover.length) continue
    leftover.sort((a, b) => a.label.localeCompare(b.label))
    const totalW = Math.max(0, leftover.length - 1) * GAP
    leftover.forEach((m, i) => {
      xOf.set(m.id, -totalW / 2 + i * GAP)
      yOf.set(m.id, gen * BAND)
      placed.add(m.id)
    })
  }

  // Recenter whole tree on seed / focus
  const focusX = seed ? (xOf.get(seed.id) ?? 0) : 0
  for (const [id, x] of [...xOf.entries()]) {
    xOf.set(id, x - focusX)
  }

  cy.batch(() => {
    for (const n of people) {
      const el = cy.getElementById(n.id)
      if (el.empty()) continue
      const x = xOf.get(n.id) ?? 0
      const y = yOf.get(n.id) ?? (n.__familyGen ?? 0) * BAND
      el.position({ x, y })
    }
    placeHubsFromMaps(cy, maps, xOf, yOf, BAND)
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

  if (mode === 'family') {
    placeFamilyPedigree(cy, data)
    cy.edges('.kin-edge').removeClass('tree-trunk')
    fitAfter(cy)
    return
  }

  if (mode === 'family-cascade') {
    placeFamilyCascade(cy, data)
    cy.edges('.kin-edge').removeClass('tree-trunk')
    fitAfter(cy)
    return
  }

  if (mode === 'family-tree') {
    placeFamilyTree(cy, data)
    cy.edges('.kin-edge').addClass('tree-trunk')
    fitAfter(cy)
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
