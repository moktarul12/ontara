import { useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { HopDirection } from '../services/sparql'
import { isOntologyClassUri } from '../services/sparql'

interface Props {
  store: OntologyStore
}

/** Hops [−][1][2][3][+] · Out / In / Both — increase & decrease both work. */
export function HopQuick({ store }: Props) {
  const { selectedNode, applyHops, shrinkHops, loading, graph, appliedHopDepth } = store
  const [direction, setDirection] = useState<HopDirection>('out')

  const canGrow =
    !!selectedNode &&
    graph.nodes.length > 0 &&
    selectedNode.type !== 'literal' &&
    !selectedNode.id.startsWith('literal:') &&
    !isOntologyClassUri(selectedNode.uri)

  return (
    <div
      className={`hop-quick ${canGrow ? 'ready' : 'idle'}`}
      role="group"
      aria-label="Expand or shrink hops"
    >
      <span className="hop-quick-kicker">Hops</span>
      <span className="hop-applied" title="Current hop depth on the graph">
        {appliedHopDepth}
      </span>
      <div className="hop-bracket hop-stepper">
        <button
          type="button"
          className="hop-step"
          disabled={loading || !canGrow || appliedHopDepth <= 0}
          onClick={() => shrinkHops(1)}
          title="Decrease hops (trim outer ring)"
          aria-label="Decrease hops"
        >
          −
        </button>
        {[1, 2, 3].map((n) => (
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
            title={
              n < appliedHopDepth
                ? `Shrink to ${n} hop${n > 1 ? 's' : ''}`
                : n > appliedHopDepth
                  ? `Grow to ${n} hop${n > 1 ? 's' : ''} (${direction})`
                  : `Already at ${n}`
            }
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className="hop-step hop-grow"
          disabled={loading || !canGrow || appliedHopDepth >= 3}
          onClick={() => {
            if (!canGrow) return
            void applyHops(Math.min(3, appliedHopDepth + 1), direction)
          }}
          title={`Increase hops (${direction})`}
          aria-label="Increase hops"
        >
          +
        </button>
      </div>
      <div className="hop-dir-mini" role="group" aria-label="Direction">
        {(
          [
            { id: 'out', label: 'Out' },
            { id: 'in', label: 'In' },
            { id: 'both', label: 'Both' },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            className={`hop-d ${direction === d.id ? 'on' : ''}`}
            onClick={() => setDirection(d.id)}
            title={
              d.id === 'out'
                ? 'Outgoing relations'
                : d.id === 'in'
                  ? 'Incoming relations'
                  : 'Both directions'
            }
          >
            {d.label}
          </button>
        ))}
      </div>
    </div>
  )
}
