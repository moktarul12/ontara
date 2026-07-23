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
  if (/human|person|actor|director|writer|composer/.test(blob)) return 'person'
  if (/film|movie|work|book|album|series|television/.test(blob)) return 'work'
  if (/character|fictional/.test(blob)) return 'character'
  if (/organisation|organization|company|studio/.test(blob)) return 'org'
  if (/city|country|place|location|geographic/.test(blob)) return 'place'
  if (/genre|concept|award|event/.test(blob)) return 'concept'
  return 'entity'
}

/** Entity-distance hop legend (0 seed · 1–5 neighbor layers). */
export const HOP_STYLE: Record<
  number,
  { fill: string; border: string; text: string; edge: string; glow: string; label: string }
> = {
  0: {
    fill: '#1e3a5f',
    border: '#7eb8da',
    text: '#ffffff',
    edge: 'rgba(126, 184, 218, 0.7)',
    glow: 'rgba(126, 184, 218, 0.35)',
    label: 'Hop 0 · Entity',
  },
  1: {
    fill: '#2f9e6b',
    border: '#2f9e6b',
    text: '#ffffff',
    edge: 'rgba(47, 158, 107, 0.75)',
    glow: 'rgba(47, 158, 107, 0.3)',
    label: 'Hop 1 · Neighbors',
  },
  2: {
    fill: '#ffffff',
    border: '#2f9e6b',
    text: '#1a3d2e',
    edge: 'rgba(47, 158, 107, 0.55)',
    glow: 'rgba(47, 158, 107, 0.2)',
    label: 'Hop 2',
  },
  3: {
    fill: '#e8f0ff',
    border: '#3a6fbf',
    text: '#16325c',
    edge: 'rgba(90, 140, 210, 0.7)',
    glow: 'rgba(90, 140, 210, 0.3)',
    label: 'Hop 3',
  },
  4: {
    fill: '#f5e8ff',
    border: '#8b5cb8',
    text: '#3a1f52',
    edge: 'rgba(139, 92, 184, 0.65)',
    glow: 'rgba(139, 92, 184, 0.25)',
    label: 'Hop 4',
  },
  5: {
    fill: '#fff0e0',
    border: '#d4782a',
    text: '#5c3010',
    edge: 'rgba(212, 120, 42, 0.65)',
    glow: 'rgba(212, 120, 42, 0.25)',
    label: 'Hop 5',
  },
}

export function hopStyle(depth: number) {
  const d = Math.max(0, Math.min(5, depth))
  return HOP_STYLE[d] ?? HOP_STYLE[1]
}

/** Colour for a node: relation hubs solid by cluster; values white + matching border. */
export function ontologyNodeColors(node: GraphNode): {
  fill: string
  border: string
  text: string
} {
  const hop = node.__hopDepth ?? 0
  if (hop === 0) {
    return { fill: '#1e3a5f', border: '#9ec9e8', text: '#ffffff' }
  }

  const key = node.__clusterKey || node.id
  const pal = CLUSTER_PALETTE[clusterColorIndex(key)]

  if (node.type === 'relation') {
    return { fill: pal.fill, border: pal.border, text: pal.text }
  }

  // Values share the cluster border; deeper hops tint fill lightly via HOP_STYLE
  if (hop >= 3) {
    const hs = hopStyle(hop)
    return { fill: hs.fill, border: pal.border, text: hs.text }
  }

  return {
    fill: pal.valueFill,
    border: pal.border,
    text: pal.valueText,
  }
}

export const KIND_STYLE: Record<
  NodeKind,
  { fill: string; border: string; text: string; shape: string; label: string }
> = {
  work: { fill: '#efe6ff', border: '#9b6bdb', text: '#3b2166', shape: 'round-rectangle', label: 'Work / Film' },
  person: { fill: '#dff8ec', border: '#1f9a68', text: '#0d4a32', shape: 'round-rectangle', label: 'Person' },
  character: { fill: '#ffe8d9', border: '#d46a2f', text: '#6b2e0c', shape: 'round-rectangle', label: 'Character' },
  place: { fill: '#f5edd8', border: '#8b6914', text: '#4a3808', shape: 'round-rectangle', label: 'Place' },
  org: { fill: '#e4ecf8', border: '#3a5f9e', text: '#1a3358', shape: 'round-rectangle', label: 'Organisation' },
  concept: { fill: '#fce4f0', border: '#c44584', text: '#6b1f48', shape: 'round-rectangle', label: 'Genre / Award' },
  literal: { fill: '#ffffff', border: '#2a9a9e', text: '#0d4a47', shape: 'round-rectangle', label: 'Data value' },
  class: { fill: '#e5f2fa', border: '#4a8fb8', text: '#1a455c', shape: 'round-rectangle', label: 'Class' },
  relation: { fill: '#2f9e6b', border: '#2f9e6b', text: '#ffffff', shape: 'round-rectangle', label: 'Property' },
  entity: { fill: '#ffffff', border: '#2a8f78', text: '#0d4a3c', shape: 'round-rectangle', label: 'Entity' },
}

export function labelBoxSize(
  rawLabel: string,
  opts?: { root?: boolean; literal?: boolean; relation?: boolean },
): { label: string; width: number; height: number; textMax: number } {
  const maxChars = opts?.literal ? 22 : opts?.root ? 26 : opts?.relation ? 18 : 22
  const t = rawLabel.trim()
  const label = t.length > maxChars ? `${t.slice(0, maxChars - 1)}…` : t
  const lineTarget = opts?.relation ? 11 : opts?.literal ? 12 : 13
  const lines = Math.max(1, Math.min(2, Math.ceil(label.length / lineTarget)))
  const longestLine = Math.min(label.length, lineTarget + 1)
  const padX = opts?.root ? 24 : opts?.relation ? 16 : 18
  const padY = opts?.root ? 16 : 12
  const charW = opts?.root ? 7 : 6.2
  const lineH = opts?.root ? 14 : 12
  const width = Math.max(
    opts?.root ? 118 : opts?.relation ? 88 : opts?.literal ? 78 : 86,
    Math.min(longestLine * charW + padX, opts?.root ? 170 : opts?.relation ? 130 : 140),
  )
  const height = Math.max(
    opts?.literal ? 30 : opts?.relation ? 34 : 36,
    lines * lineH + padY,
  )
  return { label, width, height, textMax: Math.max(52, width - 14) }
}

/** Seed centre; rings for entity-distance hops 1–5. */
export const HOP_RADIUS = [0, 150, 260, 360, 450, 530] as const
