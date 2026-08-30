import type { Milestone } from '../../types/entityDossier'
import type { EntityDossier } from '../../types/entityDossier'
import { timelineNarrativeIntro } from '../../utils/timelineEnrich'

export function ReaderTimeline({
  dossier,
  items,
  onOpenFull,
}: {
  dossier: EntityDossier
  items: Milestone[]
  onOpenFull?: () => void
}) {
  if (!items.length) return null
  const intro = timelineNarrativeIntro(dossier, items)

  return (
    <section className="or-timeline" id="or-timeline">
      <header className="or-section-head">
        <div>
          <p className="or-kicker">Life &amp; times</p>
          <h2 className="or-section-title">The story unfolds</h2>
          {intro && <p className="or-section-dek">{intro}</p>}
        </div>
        {onOpenFull && (
          <button type="button" className="or-text-btn" onClick={onOpenFull}>
            Full timeline →
          </button>
        )}
      </header>
      <ol className="or-timeline-list">
        {items.slice(0, 14).map((m, i) => (
          <li key={`${m.label}-${i}`} className="or-timeline-item">
            <div className="or-timeline-rail" aria-hidden />
            <time className="or-timeline-year">{m.year ?? '—'}</time>
            <div className="or-timeline-body">
              <strong>{m.label}</strong>
              {m.detail && <p>{m.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
