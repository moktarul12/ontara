import { useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { HopDirection } from '../services/sparql'
import { isOntologyClassUri } from '../services/sparql'

interface Props {
  store: OntologyStore
}

/** Hops [−][1][2][3][+] · Out / In / Both — increase & decrease both work. */
export function HopQuick({ store }: Props) {
  const { selectedNode, applyHops, shrinkHops, loading, graph, appliedHopDepth, pathRootId } =
    store
  const [direction, setDirection] = useState<HopDirection>('out')

  const hopRoot =
    (pathRootId && graph.nodes.some((n) => n.id === pathRootId) ? pathRootId : null) ||
    (selectedNode &&
    selectedNode.type !== 'literal' &&
    selectedNode.type !== 'relation' &&
    !selectedNode.id.startsWith('literal:') &&
    !isOntologyClassUri(selectedNode.uri)
      ? selectedNode.id
      : null)

  const canGrow = !!hopRoot && graph.nodes.length > 0

  return (
    <div
      className={`hop-quick ${canGrow ? 'ready' : 'idle'}`}
      role="group"
      aria-label="Ontology hops"
    >
      <span className="hop-quick-kicker">Hops</span>
      <span className="hop-applied" title="Ontology hop depth (0 entity · 1 property · 2 value)">
        {appliedHopDepth}
      </span>
      <div className="hop-bracket hop-stepper">
        <button
          type="button"
          className="hop-step"
          disabled={loading || !canGrow || appliedHopDepth <= 0}
          onClick={() => shrinkHops(1)}
          title="Decrease ontology hop"
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
              n === 1
                ? 'Hop 1 · ontology properties'
                : n === 2
                  ? 'Hop 2 · property values'
                  : 'Hop 3 · next ontology layer'
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
          title={`Increase ontology hop (${direction})`}
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
                ? 'Outgoing properties'
                : d.id === 'in'
                  ? 'Incoming properties'
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
