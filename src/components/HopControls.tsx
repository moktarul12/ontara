import { useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { HopDirection } from '../services/sparql'

interface Props {
  store: OntologyStore
}

export function HopControls({ store }: Props) {
  const { selectedNode, expandHops, loading, graph } = store
  const [hops, setHops] = useState(1)
  const [direction, setDirection] = useState<HopDirection>('both')

  if (!selectedNode || graph.nodes.length === 0) return null

  return (
    <div className="hop-bar">
      <span className="hop-label">Expand hops</span>
      <div className="hop-steps" role="group" aria-label="Hop depth">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={`hop-step ${hops === n ? 'active' : ''}`}
            onClick={() => setHops(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="hop-dirs" role="group" aria-label="Direction">
        {(
          [
            { id: 'out', label: 'Out →' },
            { id: 'in', label: '← In' },
            { id: 'both', label: 'Both' },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            className={`hop-dir ${direction === d.id ? 'active' : ''}`}
            onClick={() => setDirection(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="primary compact"
        disabled={loading}
        onClick={() => void expandHops(hops, direction)}
        title={`Grow ${selectedNode.label} by ${hops} hop(s), ${direction}`}
      >
        Grow tree
      </button>
    </div>
  )
}
