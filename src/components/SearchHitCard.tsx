import type { SearchHitDetail } from '../types/ontology'

interface Props {
  hit: SearchHitDetail
  disabled?: boolean
  onClick: () => void
  compact?: boolean
  actionLabel?: string
}

export function SearchHitCard({ hit, disabled, onClick, compact, actionLabel }: Props) {
  return (
    <button
      type="button"
      className={`search-hit-card kind-${hit.kind} ${compact ? 'is-compact' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className={`search-hit-avatar kind-${hit.kind}`} aria-hidden>
        {(hit.label || '?').slice(0, 1).toUpperCase()}
      </span>
      <span className="search-hit-body">
        <span className="search-hit-top">
          <strong className="search-hit-title">{hit.label}</strong>
          {hit.qid && <span className="search-hit-qid">{hit.qid}</span>}
        </span>
        <span className="search-hit-category">{hit.categoryLabel}</span>
        {!compact && hit.description && (
          <span className="search-hit-desc">{hit.description.slice(0, 120)}</span>
        )}
        {hit.meta && <span className="search-hit-meta">{hit.meta}</span>}
        {actionLabel && <span className="search-hit-action">{actionLabel}</span>}
      </span>
    </button>
  )
}
