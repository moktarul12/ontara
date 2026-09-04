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
  if (/organisation|organization|company|studio|band|business|corporation|enterprise|retailer|chain/.test(blob)) return 'org'
  if (/city|country|place|location|geographic|village/.test(blob)) return 'place'
  if (/genre|concept|award|event|prize/.test(blob)) return 'concept'
  return 'entity'
}

export const HOP_STYLE: Record<
  number,
  { fill: string; border: string; text: string; edge: string; glow: string; label: string }
> = {
  0: {
    fill: '#fff8eb',
    border: '#c07818',
    text: '#1a2332',
    edge: 'rgba(192, 120, 24, 0.55)',
    glow: 'rgba(192, 120, 24, 0.18)',
    label: 'Focus',
  },
  1: {
    fill: '#f0faf9',
    border: '#0d7a72',
    text: '#1a2332',
    edge: 'rgba(13, 122, 114, 0.45)',
    glow: 'rgba(13, 122, 114, 0.14)',
    label: '1 step away',
  },
  2: {
    fill: '#f0f5fc',
    border: '#2a6fad',
    text: '#1a2332',
    edge: 'rgba(42, 111, 173, 0.4)',
    glow: 'rgba(42, 111, 173, 0.12)',
    label: '2 steps',
  },
  3: {
    fill: '#f6f4fb',
    border: '#6b5b95',
    text: '#1a2332',
    edge: 'rgba(107, 91, 149, 0.35)',
    glow: 'rgba(107, 91, 149, 0.1)',
    label: '3 steps',
  },
  4: {
    fill: '#faf6f0',
    border: '#a07040',
    text: '#1a2332',
    edge: 'rgba(160, 112, 64, 0.35)',
    glow: 'rgba(160, 112, 64, 0.1)',
    label: '4 steps',
  },
  5: {
    fill: '#faf2f0',
    border: '#b05048',
    text: '#1a2332',
    edge: 'rgba(176, 80, 72, 0.35)',
    glow: 'rgba(176, 80, 72, 0.1)',
    label: '5 steps',
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
  work: { fill: '#e8f0fa', border: '#2a6fad', text: '#1a2332', shape: 'barrel', label: 'Work' },
  person: { fill: '#e5f4f2', border: '#0d7a72', text: '#1a2332', shape: 'ellipse', label: 'Person' },
  character: { fill: '#faf3e8', border: '#c07818', text: '#1a2332', shape: 'star', label: 'Character' },
  place: { fill: '#f4f0dc', border: '#8a7a30', text: '#1a2332', shape: 'hexagon', label: 'Place' },
  org: { fill: '#eceef6', border: '#4a5a8a', text: '#1a2332', shape: 'octagon', label: 'Org' },
  concept: { fill: '#f8eef2', border: '#a84868', text: '#1a2332', shape: 'diamond', label: 'Topic' },
  literal: { fill: '#fffdf8', border: '#0d7a72', text: '#1a2332', shape: 'bottom-round-rectangle', label: 'Fact' },
  class: { fill: '#eef4fb', border: '#2a6fad', text: '#1a2332', shape: 'pentagon', label: 'Type' },
  relation: { fill: '#cfeae4', border: '#0d7a72', text: '#0a3d3a', shape: 'round-tag', label: 'Link type' },
  entity: { fill: '#f4f6f8', border: '#7a8494', text: '#1a2332', shape: 'round-rectangle', label: 'Entity' },
}

/** Cytoscape node shape for Ontopedian's atlas (not a generic box graph). */
export function atlasShape(node: GraphNode, root?: boolean): string {
  if (root) return 'ellipse'
  if (node.type === 'relation') return 'round-tag'
  if (node.type === 'literal') return 'bottom-round-rectangle'
  return KIND_STYLE[kindOf(node)].shape
}

function clip(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

/**
 * Readable canvas labels — entity name on resources; relation/literal keep extra context.
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
    const title = clip(`${dir}${node.label}`, 18)
    return {
      label: title,
      title,
      subtitle: '',
      meta: '',
      width: Math.max(78, Math.min(title.length * 7 + 22, 132)),
      height: 30,
      textMax: 110,
      kind,
    }
  }

  const titleMax = root ? 30 : isLit ? 22 : 24
  const title = clip(node.label, titleMax)
  const typeLabel = KIND_STYLE[kind].label
  const subtitle = isLit
    ? clip(node.classes?.[0] || 'value', 20)
    : root
      ? clip(node.classes?.[0] || typeLabel, 26)
      : typeLabel

  const label = isLit ? `${title}\n${subtitle}` : title
  const longest = isLit ? Math.max(title.length, subtitle.length) : title.length
  const width = Math.max(
    root ? 140 : isLit ? 92 : 108,
    Math.min(longest * 7 + (root ? 28 : 20), root ? 192 : 148),
  )
  const height = root ? (isLit ? 50 : 40) : isLit ? 42 : 38

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

export function ontologyNodeColors(node: GraphNode): {
  fill: string
  border: string
  text: string
} {
  if (node.__familyRole === 'seed') {
    return { fill: '#fff8eb', border: '#c07818', text: '#1a2332' }
  }
  if (node.__familyRole) {
    const familyColors: Record<
      NonNullable<GraphNode['__familyRole']>,
      { fill: string; border: string; text: string }
    > = {
      seed: { fill: '#fff8eb', border: '#c07818', text: '#1a2332' },
      parent: { fill: '#eef4fb', border: '#2a6fad', text: '#1a2332' },
      child: { fill: '#e8f6f4', border: '#0d7a72', text: '#1a2332' },
      spouse: { fill: '#faf3e8', border: '#c07818', text: '#1a2332' },
      sibling: { fill: '#eef0f6', border: '#4a5a8a', text: '#1a2332' },
    }
    return familyColors[node.__familyRole]
  }

  const hop = node.__hopDepth ?? 0
  if (hop === 0) {
    return { fill: '#fff8eb', border: '#c07818', text: '#1a2332' }
  }

  if (node.type === 'relation') {
    const pal = CLUSTER_PALETTE[clusterColorIndex(node.__clusterKey || node.id)]
    return { fill: pal.fill, border: pal.border, text: pal.text }
  }

  if (node.type === 'literal') {
    const pal = CLUSTER_PALETTE[clusterColorIndex(node.__clusterKey || node.id)]
    return { fill: '#ffffff', border: pal.border, text: '#1a2332' }
  }

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

/** Outer orbit radii — roomy enough for hub chips + leaf cards without stacking. */
export const HOP_RADIUS = [0, 280, 480, 660, 820, 960] as const
export const HUB_RADIUS_FACTOR = 0.46
