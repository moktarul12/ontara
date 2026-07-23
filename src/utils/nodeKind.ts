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

/** Soft hop ring tints for edges / deep layers. */
export const HOP_STYLE: Record<
  number,
  { fill: string; border: string; text: string; edge: string; glow: string; label: string }
> = {
  0: {
    fill: '#14282c',
    border: '#e8c56a',
    text: '#fff8e8',
    edge: 'rgba(232, 197, 106, 0.75)',
    glow: 'rgba(232, 197, 106, 0.35)',
    label: 'Seed entity',
  },
  1: {
    fill: '#1a4a42',
    border: '#3ddc97',
    text: '#e8fff6',
    edge: 'rgba(61, 220, 151, 0.7)',
    glow: 'rgba(61, 220, 151, 0.28)',
    label: 'Hop 1',
  },
  2: {
    fill: '#f7fbfa',
    border: '#1a9b8e',
    text: '#102226',
    edge: 'rgba(26, 155, 142, 0.55)',
    glow: 'rgba(26, 155, 142, 0.2)',
    label: 'Hop 2',
  },
  3: {
    fill: '#eef4f8',
    border: '#4a7fa3',
    text: '#16325c',
    edge: 'rgba(74, 127, 163, 0.65)',
    glow: 'rgba(74, 127, 163, 0.25)',
    label: 'Hop 3',
  },
  4: {
    fill: '#f6f0e8',
    border: '#a67c52',
    text: '#3d2a18',
    edge: 'rgba(166, 124, 82, 0.6)',
    glow: 'rgba(166, 124, 82, 0.22)',
    label: 'Hop 4',
  },
  5: {
    fill: '#f3ebe4',
    border: '#c45b3a',
    text: '#4a2418',
    edge: 'rgba(196, 91, 58, 0.6)',
    glow: 'rgba(196, 91, 58, 0.22)',
    label: 'Hop 5',
  },
}

export function hopStyle(depth: number) {
  const d = Math.max(0, Math.min(5, depth))
  return HOP_STYLE[d] ?? HOP_STYLE[1]
}

/** Semantic colours for entity kinds (what the thing is). */
export const KIND_STYLE: Record<
  NodeKind,
  { fill: string; border: string; text: string; shape: string; label: string }
> = {
  work: { fill: '#1e2a3a', border: '#7eb0d4', text: '#e8f2fa', shape: 'round-rectangle', label: 'Work' },
  person: { fill: '#14352c', border: '#3ddc97', text: '#e8fff4', shape: 'round-rectangle', label: 'Person' },
  character: { fill: '#3a2418', border: '#e08a4a', text: '#fff0e4', shape: 'round-rectangle', label: 'Character' },
  place: { fill: '#2a2818', border: '#c9b46a', text: '#f7f0d8', shape: 'round-rectangle', label: 'Place' },
  org: { fill: '#1a2838', border: '#6a8fc4', text: '#e4ecf8', shape: 'round-rectangle', label: 'Org' },
  concept: { fill: '#2e1e28', border: '#d47a9a', text: '#fce8f0', shape: 'round-rectangle', label: 'Concept' },
  literal: { fill: '#f5faf9', border: '#2a9a9e', text: '#0d4a47', shape: 'round-rectangle', label: 'Literal' },
  class: { fill: '#1a3038', border: '#5a9ab8', text: '#e5f2fa', shape: 'round-rectangle', label: 'Class' },
  relation: { fill: '#1f6b52', border: '#3ddc97', text: '#ffffff', shape: 'round-rectangle', label: 'Property' },
  entity: { fill: '#1a2c30', border: '#5a9a92', text: '#e8f4f2', shape: 'round-rectangle', label: 'Entity' },
}

function clip(s: string, max: number) {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(1, max - 1))}…`
}

/**
 * Multi-line fact card for the canvas:
 * line1 title · line2 kind/class or IN/OUT property · line3 hop + links
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
  const hop = node.__hopDepth ?? 0
  const isRel = node.type === 'relation'
  const isLit = node.type === 'literal'
  const root = !!opts?.root
  const degree = opts?.degree ?? node.__degree ?? 0
  const kids = opts?.childCount ?? 0

  const titleMax = root ? 30 : isRel ? 18 : isLit ? 22 : 26
  const title = clip(node.label, titleMax)

  let subtitle: string
  if (isRel) {
    const dir = node.__direction === 'in' ? '← IN' : '→ OUT'
    subtitle = `${dir} · property`
  } else if (isLit) {
    subtitle = 'Data value'
  } else {
    const cls = node.classes?.[0] ? clip(node.classes[0], 20) : KIND_STYLE[kind].label
    subtitle = `${KIND_STYLE[kind].label} · ${cls}`
  }

  let meta: string
  if (isRel) {
    meta = kids > 0 ? `${kids} linked · hop ${hop}` : `hop ${hop}`
  } else if (root) {
    meta = degree > 0 ? `seed · ${degree} links` : 'seed entity'
  } else if (isLit) {
    meta = `hop ${hop}`
  } else {
    meta = degree > 0 ? `hop ${hop} · ${degree} links` : `hop ${hop}`
  }

  const label = `${title}\n${subtitle}\n${meta}`
  const longest = Math.max(title.length, subtitle.length, meta.length)
  const charW = root ? 7.2 : isRel ? 6.4 : 6.6
  const padX = root ? 28 : isRel ? 18 : 20
  const width = Math.max(
    root ? 148 : isRel ? 108 : isLit ? 96 : 118,
    Math.min(longest * charW + padX, root ? 200 : isRel ? 148 : 168),
  )
  const height = root ? 64 : isRel ? 52 : isLit ? 48 : 56

  return {
    label,
    title,
    subtitle,
    meta,
    width,
    height,
    textMax: Math.max(64, width - 16),
    kind,
  }
}

/** Colour: seed gold; properties by cluster; entities by semantic kind. */
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
    const key = node.__clusterKey || node.id
    const pal = CLUSTER_PALETTE[clusterColorIndex(key)]
    return { fill: pal.fill, border: pal.border, text: pal.text }
  }

  if (node.type === 'literal') {
    return { fill: '#f5faf9', border: '#2a9a9e', text: '#0d4a47' }
  }

  const kind = kindOf(node)
  const ks = KIND_STYLE[kind]
  if (hop >= 4) {
    const hs = hopStyle(hop)
    return { fill: hs.fill, border: ks.border, text: hs.text }
  }
  return { fill: ks.fill, border: ks.border, text: ks.text }
}

/** @deprecated use informativeCard */
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
  return { label: c.title, width: c.width, height: c.height, textMax: c.textMax }
}

/** Seed centre; rings for entity-distance hops 1–5 (wider for fact cards). */
export const HOP_RADIUS = [0, 175, 300, 420, 520, 610] as const
