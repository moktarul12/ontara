import type { GraphData, GraphNode } from '../types/ontology'
import { kindOf } from './nodeKind'

function linkEndpoint(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id
}

export function exportGraphJson(
  graph: GraphData,
  meta: { seedUri: string; seedLabel: string; source: string },
): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    seed: meta,
    nodes: graph.nodes
      .filter((n) => n.type !== 'literal')
      .map((n) => ({
        id: n.id,
        label: n.label,
        uri: n.uri,
        type: n.type,
        kind: kindOf(n),
        hopDepth: n.__hopDepth ?? 0,
      })),
    links: graph.links.map((l) => ({
      id: l.id,
      source: linkEndpoint(l.source),
      target: linkEndpoint(l.target),
      predicate: l.predicate,
      predicateLabel: l.predicateLabel,
    })),
  }
  return JSON.stringify(payload, null, 2)
}

export function exportNodesCsv(graph: GraphData): string {
  const header = 'id,label,uri,type,kind,hopDepth'
  const rows = graph.nodes
    .filter((n) => n.type === 'resource' || n.type === 'class')
    .map((n) => {
      const cols = [
        csvEscape(n.id),
        csvEscape(n.label),
        csvEscape(n.uri),
        csvEscape(n.type),
        csvEscape(kindOf(n)),
        String(n.__hopDepth ?? 0),
      ]
      return cols.join(',')
    })
  return [header, ...rows].join('\n')
}

export function exportEdgesCsv(graph: GraphData): string {
  const header = 'id,source,target,predicate,predicateLabel'
  const rows = graph.links.map((l) =>
    [
      csvEscape(l.id),
      csvEscape(linkEndpoint(l.source)),
      csvEscape(linkEndpoint(l.target)),
      csvEscape(l.predicate),
      csvEscape(l.predicateLabel),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
