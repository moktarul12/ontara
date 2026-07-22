import type { PathStep } from '../utils/graphPath'

interface Props {
  steps: PathStep[]
  rootLabel?: string
  onClear?: () => void
  onStepClick?: (nodeId: string) => void
}

/** Concept-style step-by-step multi-hop path (Movie → Character → Actor → Award). */
export function HopPathTrail({ steps, rootLabel, onClear, onStepClick }: Props) {
  if (!steps.length) return null

  const hops = Math.max(0, steps.length - 1)

  return (
    <div className="hop-path-trail">
      <div className="hop-path-head">
        <p className="hop-path-kicker">Multi-hop path</p>
        <span className="hop-path-meta">
          {hops} hop{hops === 1 ? '' : 's'}
          {rootLabel ? ` from ${rootLabel}` : ''}
        </span>
        {onClear && (
          <button type="button" className="hop-path-clear" onClick={onClear}>
            Clear
          </button>
        )}
      </div>
      <ol className="hop-path-steps">
        {steps.map((s, i) => (
          <li key={`${s.nodeId}-${i}`}>
            {i > 0 && s.predicateLabel ? (
              <span className="hop-path-pred">{s.predicateLabel}</span>
            ) : null}
            <button
              type="button"
              className={`hop-path-node ${i === 0 ? 'root' : ''} ${i === steps.length - 1 ? 'leaf' : ''}`}
              onClick={() => onStepClick?.(s.nodeId)}
              title={s.nodeId}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
