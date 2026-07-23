import type { GraphNode } from '../types/ontology'
import { CLUSTER_PALETTE, clusterColorIndex } from '../services/ontologyHops'

export type NodeKind =
  | 'work'
  | 'person'
  | 'character'
  | 'place'
  | 'org'
  | 'concept'
  | 'literal'
  | 'class'
  | 'relation'
  | 'entity'

export function kindOf(node: GraphNode): NodeKind {
  if (node.type === 'relation') return 'relation'
  if (node.type === 'literal') return 'literal'
  if (node.type === 'class') return 'class'
  const blob = `${node.classes?.join(' ') ?? ''} ${node.label}`.toLowerCase()
  if (/human|person|actor|director|writer|composer|singer/.test(blob)) return 'person'
  if (/film|movie|work|book|album|series|television|song/.test(blob)) return 'work'
  if (/character|fictional/.test(blob)) return 'character'
  if (/organisation|organization|company|studio|band/.test(blob)) return 'org'
  if (/city|country|place|location|geographic|village/.test(blob)) return 'place'
  if (/genre|concept|award|event|prize/.test(blob)) return 'concept'
  return 'entity'
}

export const HOP_STYLE: Record<
  number,
  { fill: string; border: string; text: string; edge: string; glow: string; label: string }
> = {
  0: {
    fill: '#14282c',
    border: '#e8c56a',
    text: '#fff8e8',
    edge: 'rgba(232, 197, 106, 0.55)',
    glow: 'rgba(232, 197, 106, 0.3)',
    label: 'Seed',
  },
  1: {
    fill: '#f4fbf8',
    border: '#1a9b8e',
    text: '#102226',
    edge: 'rgba(61, 220, 151, 0.45)',
    glow: 'rgba(61, 220, 151, 0.2)',
    label: 'Hop 1',
  },
  2: {
    fill: '#f4f8fc',
    border: '#4a7fa3',
    text: '#16325c',
    edge: 'rgba(74, 127, 163, 0.45)',
    glow: 'rgba(74, 127, 163, 0.2)',
    label: 'Hop 2',
  },
  3: {
    fill: '#f8f4fc',
    border: '#7a5ca3',
    text: '#2a1a48',
    edge: 'rgba(122, 92, 163, 0.4)',
    glow: 'rgba(122, 92, 163, 0.18)',
    label: 'Hop 3',
  },
  4: {
    fill: '#fff8f0',
    border: '#a67c52',
    text: '#3d2a18',
    edge: 'rgba(166, 124, 82, 0.4)',
    glow: 'rgba(166, 124, 82, 0.18)',
    label: 'Hop 4',
  },
  5: {
    fill: '#fdf6f6',
    border: '#c45b3a',
    text: '#4a2418',
    edge: 'rgba(196, 91, 58, 0.4)',
    glow: 'rgba(196, 91, 58, 0.18)',
    label: 'Hop 5',
  },
}

export function hopStyle(depth: number) {
  const d = Math.max(0, Math.min(5, depth))
  return HOP_STYLE[d] ?? HOP_STYLE[1]
}

export const KIND_STYLE: Record<
  NodeKind,
  { fill: string; border: string; text: string; shape: string; label: string }
> = {
  work: { fill: '#f4f8fc', border: '#4a7fa3', text: '#16325c', shape: 'round-rectangle', label: 'Work' },
  person: { fill: '#f4fbf8', border: '#1a9b8e', text: '#0d3d32', shape: 'round-rectangle', label: 'Person' },
  character: { fill: '#fff8f0', border: '#c47a3a', text: '#5c3010', shape: 'round-rectangle', label: 'Character' },
  place: { fill: '#faf8f0', border: '#a6904a', text: '#3d3518', shape: 'round-rectangle', label: 'Place' },
  org: { fill: '#f4f6fc', border: '#5a6fa3', text: '#1a2848', shape: 'round-rectangle', label: 'Org' },
  concept: { fill: '#fdf6f9', border: '#c45b7a', text: '#4a1f35', shape: 'round-rectangle', label: 'Concept' },
  literal: { fill: '#ffffff', border: '#2a9a9e', text: '#0d4a47', shape: 'round-rectangle', label: 'Literal' },
  class: { fill: '#f2f7fa', border: '#4a8fb8', text: '#1a455c', shape: 'round-rectangle', label: 'Class' },
  relation: { fill: '#1f6b52', border: '#3ddc97', text: '#ffffff', shape: 'round-rectangle', label: 'Property' },
  entity: { fill: '#f7fbfa', border: '#3a7a72', text: '#102226', shape: 'round-rectangle', label: 'Entity' },
}

function clip(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

/**
 * Readable canvas labels:
 * - Property hubs → short chip (name only)
 * - Entities → title + kind (2 lines max)
 * Hop/degree live in the focus HUD, not on every card.
 */
export function informativeCard(
  node: GraphNode,
  opts?: { root?: boolean; degree?: number; childCount?: number },
): {
  label: string
  title: string
  subtitle: string
  meta: string
  width: number
  height: number
  textMax: number
  kind: NodeKind
} {
  const kind = kindOf(node)
  const isRel = node.type === 'relation'
  const isLit = node.type === 'literal'
  const root = !!opts?.root

  if (isRel) {
    const dir = node.__direction === 'in' ? '← ' : ''
    const title = clip(`${dir}${node.label}`, 14)
    return {
      label: title,
      title,
      subtitle: '',
      meta: '',
      width: Math.max(72, Math.min(title.length * 7.2 + 20, 118)),
      height: 28,
      textMax: 100,
      kind,
    }
  }

  const titleMax = root ? 28 : isLit ? 20 : 22
  const title = clip(node.label, titleMax)
  const subtitle = isLit
    ? clip(node.classes?.[0] || 'value', 18)
    : root
      ? clip(node.classes?.[0] || KIND_STYLE[kind].label, 22)
      : KIND_STYLE[kind].label

  const label = `${title}\n${subtitle}`
  const longest = Math.max(title.length, subtitle.length)
  const width = Math.max(
    root ? 132 : isLit ? 88 : 100,
    Math.min(longest * 6.8 + (root ? 26 : 18), root ? 180 : 140),
  )
  const height = root ? 48 : isLit ? 40 : 44

  return {
    label,
    title,
    subtitle,
    meta: '',
    width,
    height,
    textMax: Math.max(56, width - 14),
    kind,
  }
}

/** Seed gold; hubs by cluster; values light fill + matching cluster border. */
export function ontologyNodeColors(node: GraphNode): {
  fill: string
  border: string
  text: string
} {
  const hop = node.__hopDepth ?? 0
  if (hop === 0) {
    return { fill: '#14282c', border: '#e8c56a', text: '#fff8e8' }
  }

  if (node.type === 'relation') {
    const pal = CLUSTER_PALETTE[clusterColorIndex(node.__clusterKey || node.id)]
    return { fill: pal.fill, border: pal.border, text: pal.text }
  }

  if (node.type === 'literal') {
    const pal = CLUSTER_PALETTE[clusterColorIndex(node.__clusterKey || node.id)]
    return { fill: '#ffffff', border: pal.border, text: '#0d4a47' }
  }

  // Entity values: light card + property-cluster border (readable groups)
  if (node.__clusterKey) {
    const pal = CLUSTER_PALETTE[clusterColorIndex(node.__clusterKey)]
    return { fill: pal.valueFill, border: pal.border, text: pal.valueText }
  }

  const ks = KIND_STYLE[kindOf(node)]
  return { fill: ks.fill, border: ks.border, text: ks.text }
}

export function labelBoxSize(
  rawLabel: string,
  opts?: { root?: boolean; literal?: boolean; relation?: boolean },
): { label: string; width: number; height: number; textMax: number } {
  const fake: GraphNode = {
    id: '_',
    uri: '_',
    label: rawLabel,
    type: opts?.relation ? 'relation' : opts?.literal ? 'literal' : 'resource',
  }
  const c = informativeCard(fake, { root: opts?.root })
  return { label: c.label, width: c.width, height: c.height, textMax: c.textMax }
}

/** Entity-hop radii; hubs sit inward on the same hop. */
export const HOP_RADIUS = [0, 210, 360, 500, 620, 730] as const
export const HUB_RADIUS_FACTOR = 0.58
