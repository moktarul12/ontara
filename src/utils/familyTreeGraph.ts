import type { GraphData, GraphLink, GraphNode } from '../types/ontology'

export type PedigreeRelation = 'father' | 'mother' | 'parent' | 'child' | 'spouse' | 'sibling'

export type PedigreeEdge = {
  id: string
  source: string
  target: string
  relation: PedigreeRelation
  label: string
}

export type KinMaps = {
  people: GraphNode[]
  hubs: GraphNode[]
  byId: Map<string, GraphNode>
  childrenOf: Map<string, string[]>
  parentsOf: Map<string, string[]>
  spousesOf: Map<string, string[]>
  siblingsOf: Map<string, string[]>
  hubSubject: Map<string, string>
  hubKids: Map<string, string[]>
}

function linkEnds(l: GraphLink): { source: string; target: string } {
  const source = typeof l.source === 'string' ? l.source : l.source.id
  const target = typeof l.target === 'string' ? l.target : l.target.id
  return { source, target }
}

function push(map: Map<string, string[]>, key: string, val: string) {
  const list = map.get(key) ?? []
  if (!list.includes(val)) list.push(val)
  map.set(key, list)
}

function hubRelation(hub: GraphNode, hubId: string): PedigreeRelation | null {
  const label = (hub.label || '').toLowerCase()
  const pred = (hubId.split(':')[2] || hub.__predicate || '').toLowerCase()
  if (label === 'father' || pred.includes('p22')) return 'father'
  if (label === 'mother' || pred.includes('p25')) return 'mother'
  if (label === 'parents' || pred === 'parents') return 'parent'
  if (label === 'child' || pred.includes('p40')) return 'child'
  if (label === 'spouse' || pred.includes('p26')) return 'spouse'
  if (label === 'sibling' || pred.includes('p3373')) return 'sibling'
  return null
}

/** Resolve person→hub→person kinship into adjacency maps. */
export function buildKinMaps(data: GraphData): KinMaps {
  const people = data.nodes.filter((n) => n.type !== 'relation' && n.type !== 'literal')
  const hubs = data.nodes.filter((n) => n.type === 'relation')
  const byId = new Map(people.map((n) => [n.id, n]))
  const childrenOf = new Map<string, string[]>()
  const parentsOf = new Map<string, string[]>()
  const spousesOf = new Map<string, string[]>()
  const siblingsOf = new Map<string, string[]>()
  const hubSubject = new Map<string, string>()
  const hubKids = new Map<string, string[]>()

  for (const l of data.links) {
    const { source, target } = linkEnds(l)
    if (source.startsWith('relhub:') && byId.has(target)) {
      push(hubKids, source, target)
    } else if (byId.has(source) && target.startsWith('relhub:')) {
      hubSubject.set(target, source)
    }
  }

  for (const hub of hubs) {
    const subject = hubSubject.get(hub.id) || hub.__parentId
    if (!subject) continue
    const kids = hubKids.get(hub.id) ?? []
    const rel = hubRelation(hub, hub.id)
    if (!rel) continue

    for (const t of kids) {
      if (!byId.has(t)) continue
      if (rel === 'child') {
        push(childrenOf, subject, t)
        push(parentsOf, t, subject)
      } else if (rel === 'father' || rel === 'mother' || rel === 'parent') {
        push(parentsOf, subject, t)
        push(childrenOf, t, subject)
      } else if (rel === 'spouse') {
        push(spousesOf, subject, t)
        push(spousesOf, t, subject)
      } else if (rel === 'sibling') {
        push(siblingsOf, subject, t)
        push(siblingsOf, t, subject)
      }
    }
  }

  return {
    people,
    hubs,
    byId,
    childrenOf,
    parentsOf,
    spousesOf,
    siblingsOf,
    hubSubject,
    hubKids,
  }
}

const REL_LABEL: Record<PedigreeRelation, string> = {
  father: 'Father',
  mother: 'Mother',
  parent: 'Parent',
  child: 'Child',
  spouse: 'Spouse',
  sibling: 'Sibling',
}

/** Direct person↔person edges with readable relation labels (no hub chips). */
export function buildPedigreeEdges(data: GraphData, maps: KinMaps): PedigreeEdge[] {
  const out: PedigreeEdge[] = []
  const seen = new Set<string>()

  const add = (source: string, target: string, relation: PedigreeRelation) => {
    const key = `${source}|${relation}|${target}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      id: `ped-${source}-${relation}-${target}`,
      source,
      target,
      relation,
      label: REL_LABEL[relation],
    })
  }

  for (const hub of maps.hubs) {
    const subject = maps.hubSubject.get(hub.id) || hub.__parentId
    if (!subject) continue
    const rel = hubRelation(hub, hub.id)
    if (!rel) continue
    for (const target of maps.hubKids.get(hub.id) ?? []) {
      if (!maps.byId.has(target)) continue
      if (rel === 'child') {
        add(subject, target, 'child')
      } else if (rel === 'father' || rel === 'mother') {
        add(target, subject, rel)
      } else if (rel === 'parent') {
        add(target, subject, 'parent')
      } else if (rel === 'spouse') {
        add(subject, target, 'spouse')
      } else if (rel === 'sibling') {
        add(subject, target, 'sibling')
      }
    }
  }

  // Legacy direct edges if present
  for (const l of data.links) {
    const { source, target } = linkEnds(l)
    if (!maps.byId.has(source) || !maps.byId.has(target)) continue
    const pred = (l.predicate || '').toLowerCase()
    const label = (l.predicateLabel || '').toLowerCase()
    if (/\/p40$|child/.test(pred) || label.includes('child')) {
      add(source, target, 'child')
    } else if (/\/p22$|father/.test(pred) || label.includes('father')) {
      add(source, target, 'father')
    } else if (/\/p25$|mother/.test(pred) || label.includes('mother')) {
      add(source, target, 'mother')
    } else if (/\/p26$|spouse|partner/.test(pred) || /spouse|partner/.test(label)) {
      add(source, target, 'spouse')
    } else if (/\/p3373$|sibling/.test(pred) || label.includes('sibling')) {
      add(source, target, 'sibling')
    }
  }

  return out
}

export function roleBadge(role?: GraphNode['__familyRole']): string {
  if (role === 'seed') return 'Focus'
  if (role === 'parent') return 'Parent'
  if (role === 'child') return 'Child'
  if (role === 'spouse') return 'Spouse'
  if (role === 'sibling') return 'Sibling'
  return ''
}

export function generationLabel(gen: number): string {
  if (gen < 0) return `${Math.abs(gen)} gen up`
  if (gen > 0) return `${gen} gen down`
  return 'Focus generation'
}
