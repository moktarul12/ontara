import type { Milestone } from '../../types/entityDossier'

export function HorizontalTimeline({
  items,
  onSeeAll,
  narrative,
}: {
  items: Milestone[]
  onSeeAll?: () => void
  narrative?: string
}) {
  if (!items.length) return null
  const slice = items.slice(0, 8)

  return (
    <section className="ke-panel ke-timeline-panel">
      <header className="ke-panel-head">
        <div>
          <h2>Timeline</h2>
          {narrative && <p className="ke-panel-sub">{narrative}</p>}
        </div>
        {onSeeAll && (
          <button type="button" className="ke-link-btn" onClick={onSeeAll}>
            View full →
          </button>
        )}
      </header>
      <div className="ke-timeline-rail" role="list">
        {slice.map((m, i) => (
          <article key={`${m.label}-${i}`} className="ke-timeline-node" role="listitem">
            <div className="ke-timeline-dot" aria-hidden />
            {m.year && <time className="ke-timeline-year">{m.year}</time>}
            <strong>{m.label}</strong>
            {m.detail && <span>{m.detail}</span>}
          </article>
        ))}
      </div>
    </section>
  )
}
