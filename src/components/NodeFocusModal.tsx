import { useMemo } from 'react'
import type { GraphData, GraphNode } from '../types/ontology'
import { kindOf } from '../utils/nodeKind'
import { findShortestPath } from '../utils/graphPath'

interface Props {
  node: GraphNode
  graph: GraphData
  rootId: string | null
  rootLabel: string
  dataProperties: { predicateLabel: string; value: string }[]
  onClose: () => void
  onExpand: () => void
  onFamilyTree?: () => void
  onOpenFocus: () => void
}

function directLinks(
  graph: GraphData,
  nodeId: string,
): { predicateLabel: string; otherLabel: string; otherId: string; direction: 'in' | 'out' }[] {
  const labelOf = new Map(graph.nodes.map((n) => [n.id, n.label]))
  const rows: {
    predicateLabel: string
    otherLabel: string
    otherId: string
    direction: 'in' | 'out'
  }[] = []

  for (const l of graph.links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id
    const t = typeof l.target === 'string' ? l.target : l.target.id
    if (s === nodeId && !t.startsWith('literal:')) {
      const hub = graph.nodes.find((n) => n.id === t)
      if (hub?.type === 'relation') {
        const pred = hub.label || l.predicateLabel || 'related'
        for (const l2 of graph.links) {
          const s2 = typeof l2.source === 'string' ? l2.source : l2.source.id
          const t2 = typeof l2.target === 'string' ? l2.target : l2.target.id
          if (s2 === t && t2 !== nodeId && !t2.startsWith('literal:')) {
            rows.push({
              predicateLabel: pred,
              otherLabel: labelOf.get(t2) || t2,
              otherId: t2,
              direction: 'out',
            })
          }
        }
      } else {
        rows.push({
          predicateLabel: l.predicateLabel || 'related',
          otherLabel: labelOf.get(t) || t,
          otherId: t,
          direction: 'out',
        })
      }
    }
    if (t === nodeId && !s.startsWith('literal:')) {
      const hub = graph.nodes.find((n) => n.id === s)
      if (hub?.type === 'relation') {
        const pred = hub.label || l.predicateLabel || 'related'
        for (const l2 of graph.links) {
          const s2 = typeof l2.source === 'string' ? l2.source : l2.source.id
          const t2 = typeof l2.target === 'string' ? l2.target : l2.target.id
          if (t2 === s && s2 !== nodeId && !s2.startsWith('literal:')) {
            rows.push({
              predicateLabel: pred,
              otherLabel: labelOf.get(s2) || s2,
              otherId: s2,
              direction: 'in',
            })
          }
        }
      } else {
        rows.push({
          predicateLabel: l.predicateLabel || 'related',
          otherLabel: labelOf.get(s) || s,
          otherId: s,
          direction: 'in',
        })
      }
    }
  }

  const seen = new Set<string>()
  return rows.filter((r) => {
    const key = `${r.predicateLabel}:${r.otherId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function NodeFocusModal({
  node,
  graph,
  rootId,
  rootLabel,
  dataProperties,
  onClose,
  onExpand,
  onFamilyTree,
  onOpenFocus,
}: Props) {
  const kind = kindOf(node)
  const path = useMemo(() => {
    if (!rootId || rootId === node.id) return null
    return findShortestPath(graph, rootId, node.id)
  }, [graph, rootId, node.id])

  const links = useMemo(() => directLinks(graph, node.id).slice(0, 8), [graph, node.id])

  const blurb =
    dataProperties.find((p) => /description|abstract|summary/i.test(p.predicateLabel))?.value ||
    (node.classes?.length
      ? `${kind} · ${node.classes.slice(0, 3).join(', ')}`
      : `${kind} on this knowledge map`)

  const facts = dataProperties
    .filter((p) => p.value && !/description|abstract|image/i.test(p.predicateLabel))
    .slice(0, 4)

  const isPerson = kind === 'person' || /human|person/i.test(node.classes?.join(' ') ?? '')
  const isFocus = node.id === rootId

  return (
    <div className="node-focus-backdrop" role="presentation" onClick={onClose}>
      <div
        className="node-focus-modal"
        role="dialog"
        aria-labelledby="node-focus-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="node-focus-head">
          <div className="node-focus-identity">
            {node.__imageUrl ? (
              <img className="node-focus-portrait" src={node.__imageUrl} alt="" />
            ) : (
              <span className="node-focus-portrait placeholder" aria-hidden>
                {node.label.slice(0, 1)}
              </span>
            )}
            <div>
              <p className="node-focus-kicker">
                {kind}
                {node.__hopDepth != null ? ` · ${node.__hopDepth} hop${node.__hopDepth === 1 ? '' : 's'}` : ''}
              </p>
              <h2 id="node-focus-title">{node.label}</h2>
            </div>
          </div>
          <button type="button" className="node-focus-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <section className="node-focus-section">
          <h3>How it connects</h3>
          {path && path.steps.length > 1 ? (
            <p className="node-focus-path">
              {path.steps.map((s, i) => (
                <span key={s.nodeId}>
                  {i > 0 && (
                    <em>{s.predicateLabel ? ` → ${s.predicateLabel} → ` : ' → '}</em>
                  )}
                  <strong>{s.label}</strong>
                </span>
              ))}
            </p>
          ) : isFocus ? (
            <p className="muted">Focus entity — {rootLabel}</p>
          ) : (
            <p className="muted">No path to {rootLabel} on the current map yet.</p>
          )}
          {links.length > 0 && (
            <ul className="node-focus-links">
              {links.map((l) => (
                <li key={`${l.predicateLabel}-${l.otherId}`}>
                  <span className="nf-pred">{l.predicateLabel}</span>
                  <span>{l.direction === 'in' ? '←' : '→'}</span>
                  <span>{l.otherLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="node-focus-section">
          <h3>About</h3>
          <p className="node-focus-blurb">{blurb.slice(0, 280)}</p>
          {facts.length > 0 && (
            <dl className="node-focus-facts">
              {facts.map((p) => (
                <div key={p.predicateLabel}>
                  <dt>{p.predicateLabel}</dt>
                  <dd>{p.value.slice(0, 100)}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <footer className="node-focus-actions">
          <button type="button" className="eh-btn primary" onClick={onExpand}>
            Expand connections
          </button>
          {!isFocus && (
            <button type="button" className="eh-btn" onClick={onOpenFocus}>
              Open as focus
            </button>
          )}
          {isPerson && onFamilyTree && (
            <button type="button" className="eh-btn ghost" onClick={onFamilyTree}>
              Family tree
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
