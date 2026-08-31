import { useMemo, useState } from 'react'
import type { EntityDossier } from '../../types/entityDossier'
import {
  buildCorpusTimeline,
  type CorpusTimelineEventKind,
} from '../../services/corpusTimelineBuilder'

const ICON: Record<CorpusTimelineEventKind, string> = {
  work: '🎬',
  award: '🏆',
  life: '📍',
  milestone: '✦',
}

const INITIAL_YEARS = 12
const LOAD_MORE = 8

export function CorpusYearTimeline({ dossier }: { dossier: EntityDossier }) {
  const data = useMemo(() => buildCorpusTimeline(dossier), [dossier])
  const [visibleCount, setVisibleCount] = useState(INITIAL_YEARS)

  if (!data.years.length) {
    return null
  }

  const visible = data.years.slice(0, visibleCount)
  const hasMore = visibleCount < data.years.length
  const range =
    data.rangeStart && data.rangeEnd
      ? `${data.rangeStart} – ${data.rangeEnd}`
      : undefined

  return (
    <section className="corpus-year-timeline" id="corpus-year-timeline">
      <header className="corpus-year-timeline-head">
        <div>
          <h2>Timeline</h2>
          <p>
            {data.totalDated} event{data.totalDated === 1 ? '' : 's'}
            {range ? ` · ${range}` : ''}
            {' · '}year by year, month by month
          </p>
        </div>
      </header>

      <div className="corpus-year-groups">
        {visible.map((group) => (
          <article key={group.year} className="corpus-year-group">
            <header className="corpus-year-group-head">
              <h3>{group.year}</h3>
              <span>
                {group.events.length} event{group.events.length === 1 ? '' : 's'}
              </span>
            </header>

            {group.months.map((monthGroup) => (
              <div
                key={`${group.year}-${monthGroup.month ?? 'general'}`}
                className="corpus-month-group"
              >
                <h4 className="corpus-month-label">{monthGroup.monthLabel}</h4>
                <ul className="corpus-year-events">
                  {monthGroup.events.map((e, i) => (
                    <li
                      key={`${group.year}-${monthGroup.monthLabel}-${e.title}-${i}`}
                      className={`corpus-year-event is-${e.kind}`}
                    >
                      <span className={`corpus-year-event-icon ${e.kind}`} aria-hidden>
                        {ICON[e.kind]}
                      </span>
                      <div className="corpus-year-event-body">
                        <strong>{e.title}</strong>
                        <span>{e.subtitle}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </article>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="corpus-load-more"
          onClick={() => setVisibleCount((n) => n + LOAD_MORE)}
        >
          Show {Math.min(LOAD_MORE, data.years.length - visibleCount)} more years
        </button>
      )}
    </section>
  )
}
