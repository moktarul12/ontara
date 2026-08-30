import type { EntityDossier } from '../../types/entityDossier'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'

export function ReaderFactsStrip({ dossier }: { dossier: EntityDossier }) {
  const items =
    dossier.kind === 'person'
      ? buildPersonDashboardData(dossier).highlights.slice(0, 5)
      : dossier.kind === 'org'
        ? buildOrgDashboardData(dossier).highlights.slice(0, 5)
        : dossier.kind === 'work'
          ? buildWorkDashboardData(dossier).highlights.slice(0, 5)
          : dossier.summary.storyBeats.slice(0, 5).map((b) => ({
              label: b.label,
              value: b.detail,
            }))

  if (!items.length) return null

  return (
    <section className="or-facts" id="or-facts">
      <p className="or-kicker">At a glance</p>
      <div className="or-facts-scroll">
        {items.map((f) => (
          <article key={f.label} className="or-fact-chip">
            <span>{f.label}</span>
            <strong>{f.value}</strong>
          </article>
        ))}
      </div>
    </section>
  )
}
