import { useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { HopDirection } from '../services/sparql'
import { isRelationHubId, MAX_ONTOLOGY_HOPS } from '../services/ontologyHops'

interface Props {
  store: OntologyStore
}

const HOP_LEVELS = [1, 2, 3, 4, 5] as const

/**
 * Hops = entity distance from the seed.
 * Out  = follow only outgoing properties
 * In   = follow only incoming properties
 * Both = both directions
 * Stops early when SPARQL returns no further entities (max 5).
 */
export function HopQuick({ store }: Props) {
  const { applyHops, shrinkHops, loading, graph, appliedHopDepth, pathRootId, selectedNode } =
    store
  const [direction, setDirection] = useState<HopDirection>('both')

  const hopRoot =
    (pathRootId && graph.nodes.some((n) => n.id === pathRootId) ? pathRootId : null) ||
    (selectedNode &&
    !isRelationHubId(selectedNode.id) &&
    !selectedNode.id.startsWith('literal:')
      ? selectedNode.id
      : null)

  const canGrow = !!hopRoot && graph.nodes.length > 0

  return (
    <div
      className={`hop-quick ${canGrow ? 'ready' : 'idle'}`}
      role="group"
      aria-label="Entity hops"
    >
      <span className="hop-quick-kicker">Hops</span>
      <span
        className="hop-applied"
        title="Entity distance from seed (stops early if no more data)"
      >
        {appliedHopDepth}
      </span>
      <div className="hop-bracket hop-stepper">
        <button
          type="button"
          className="hop-step"
          disabled={loading || !canGrow || appliedHopDepth <= 0}
          onClick={() => shrinkHops(1)}
          title="Decrease hop"
          aria-label="Decrease hops"
        >
          −
        </button>
        {HOP_LEVELS.map((n) => (
          <button
            key={n}
            type="button"
            className={`hop-n ${appliedHopDepth === n ? 'on' : ''} ${n < appliedHopDepth ? 'below' : ''}`}
            disabled={loading || !canGrow}
            onClick={() => {
              if (!canGrow) return
              void applyHops(n, direction)
            }}
            aria-pressed={appliedHopDepth === n}
            title={`Hop ${n} · ${direction} · property hubs + values at distance ${n}`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="hop-step hop-grow"
          disabled={loading || !canGrow || appliedHopDepth >= MAX_ONTOLOGY_HOPS}
          onClick={() => {
            if (!canGrow) return
            void applyHops(Math.min(MAX_ONTOLOGY_HOPS, appliedHopDepth + 1), direction)
          }}
          title={`Grow one hop (${direction})`}
          aria-label="Increase hops"
        >
          +
        </button>
      </div>
      <div className="hop-dir-mini" role="group" aria-label="Direction">
        {(
          [
            {
              id: 'out' as const,
              label: 'Out',
              title: 'Outgoing only — seed → property → values',
            },
            {
              id: 'in' as const,
              label: 'In',
              title: 'Incoming only — values → property → seed',
            },
            {
              id: 'both' as const,
              label: 'Both',
              title: 'Both directions',
            },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            className={`hop-d ${direction === d.id ? 'on' : ''}`}
            onClick={() => setDirection(d.id)}
            title={d.title}
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}
