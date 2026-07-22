import { useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { HopDirection } from '../services/sparql'
import { isOntologyClassUri } from '../services/sparql'

interface Props {
  store: OntologyStore
}

/** Always visible: [1][2][3] · Out / In / Both · + */
export function HopQuick({ store }: Props) {
  const { selectedNode, expandHops, loading, graph } = store
  const [hops, setHops] = useState(1)
  const [direction, setDirection] = useState<HopDirection>('out')

  const canGrow =
    !!selectedNode &&
    graph.nodes.length > 0 &&
    !isOntologyClassUri(selectedNode.uri)

  return (
    <div
      className={`hop-quick ${canGrow ? 'ready' : 'idle'}`}
      role="group"
      aria-label="Expand hops"
    >
      <span className="hop-quick-kicker">Hops</span>
      <div className="hop-bracket">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`hop-n ${hops === n ? 'on' : ''}`}
            onClick={() => setHops(n)}
            aria-pressed={hops === n}
          >
            {n}
          </button>
        ))}
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
            title={d.id}
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="hop-plus"
        disabled={loading || !canGrow}
        onClick={() => {
          if (!canGrow || !selectedNode) return
          void expandHops(hops, direction)
        }}
        title={
          canGrow
            ? `Grow ${hops} hop${hops > 1 ? 's' : ''} (${direction}) from ${selectedNode!.label}`
            : 'Open an entity from search to expand hops'
        }
      >
        +
      </button>
    </div>
  )
}
