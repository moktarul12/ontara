import type { GraphNode } from '../types/ontology'

export type NodeKind =
  | 'work'
  | 'person'
  | 'character'
  | 'place'
  | 'org'
  | 'concept'
  | 'literal'
  | 'class'
  | 'entity'

export function kindOf(node: GraphNode): NodeKind {
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

/** Same hop ring → same colour family (connected neighbours share a look). */
export const HOP_STYLE: Record<
  number,
  { fill: string; border: string; text: string; edge: string; glow: string; label: string }
> = {
  0: {
    fill: '#f3e9ff',
    border: '#7b4fc7',
    text: '#2d1858',
    edge: 'rgba(155, 107, 219, 0.7)',
    glow: 'rgba(155, 107, 219, 0.35)',
    label: 'Hop 0 · Seed',
  },
  1: {
    fill: '#dff8ec',
    border: '#1a9a6a',
    text: '#0a4330',
    edge: 'rgba(45, 180, 120, 0.7)',
    glow: 'rgba(61, 220, 151, 0.3)',
    label: 'Hop 1 · Direct',
  },
  2: {
    fill: '#ffe8d6',
    border: '#d45a1a',
    text: '#5c2808',
    edge: 'rgba(224, 122, 58, 0.7)',
    glow: 'rgba(224, 122, 58, 0.3)',
    label: 'Hop 2 · Linked',
  },
  3: {
    fill: '#e4f0ff',
    border: '#3a6fbf',
    text: '#16325c',
    edge: 'rgba(90, 140, 210, 0.7)',
    glow: 'rgba(90, 140, 210, 0.3)',
    label: 'Hop 3 · Far',
  },
}

export function hopStyle(depth: number) {
  const d = Math.max(0, Math.min(3, depth))
  return HOP_STYLE[d] ?? HOP_STYLE[1]
}

/** Kept for kind chips / inspector; graph fill is hop-driven. */
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
  literal: { fill: '#dff5f3', border: '#1f8f88', text: '#0d4a47', shape: 'round-rectangle', label: 'Data property' },
  class: { fill: '#e5f2fa', border: '#4a8fb8', text: '#1a455c', shape: 'round-rectangle', label: 'Class' },
  entity: { fill: '#e8f6f2', border: '#2a8f78', text: '#0d4a3c', shape: 'round-rectangle', label: 'Entity' },
}

/** Compact card so hops sit closer with shorter edges. */
export function labelBoxSize(
  rawLabel: string,
  opts?: { root?: boolean; literal?: boolean },
): { label: string; width: number; height: number; textMax: number } {
  const maxChars = opts?.literal ? 22 : opts?.root ? 28 : 24
  const t = rawLabel.trim()
  const label = t.length > maxChars ? `${t.slice(0, maxChars - 1)}…` : t
  const lineTarget = opts?.literal ? 12 : 13
  const lines = Math.max(1, Math.min(2, Math.ceil(label.length / lineTarget)))
  const longestLine = Math.min(label.length, lineTarget + 1)
  const padX = opts?.root ? 22 : 18
  const padY = opts?.root ? 14 : 12
  const charW = opts?.root ? 6.8 : 6.2
  const lineH = opts?.root ? 14 : 12
  const width = Math.max(
    opts?.root ? 108 : opts?.literal ? 78 : 86,
    Math.min(longestLine * charW + padX, opts?.root ? 168 : 140),
  )
  const height = Math.max(opts?.literal ? 30 : 36, lines * lineH + padY)
  return { label, width, height, textMax: Math.max(52, width - 14) }
}

/** Tight orbital radii — keeps edges short between hop rings. */
export const HOP_RADIUS = [0, 145, 255, 355] as const
