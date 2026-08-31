import type { CSSProperties } from 'react'
import type { EntityDossier, HeroMetric } from '../../types/entityDossier'
import type { WorkDashboardData } from '../../services/workDashboardBuilder'
import { resolveArticleLead } from '../../utils/dossierNarrative'

const METRIC_ICONS: Record<HeroMetric['icon'], string> = {
  film: '🎬',
  award: '🏆',
  star: '⭐',
  years: '📅',
}

const PILL_ICONS: Record<string, string> = {
  Released: '📅',
  Genre: '🎭',
  Country: '🌍',
}

export function WorkHero({
  dossier,
  displayLabel,
  workData,
  enriching,
  onOpenGraph,
}: {
  dossier: EntityDossier
  displayLabel: string
  workData: WorkDashboardData
  enriching?: boolean
  onOpenGraph: () => void
}) {
  const intro = resolveArticleLead(dossier) ?? dossier.hero.intro
  const tags = workData.genreTags.length
    ? ['Film', ...workData.genreTags.slice(0, 2), 'Wikidata']
    : ['Work', 'Wikidata']

  return (
    <section
      className="entity-hero-wrap work-hero-wrap ke-v3-hero-wrap"
      id="cat-profile"
      aria-label="Film profile"
      style={
        dossier.hero.imageUrl
          ? ({ '--hero-bg': `url(${dossier.hero.imageUrl})` } as CSSProperties)
          : undefined
      }
    >
      <article className="entity-hero-card work-hero-card">
        <div className="entity-hero-card-top">
          <div className="entity-hero-media-wrap">
            {dossier.hero.imageUrl ? (
              <img src={dossier.hero.imageUrl} alt="" className="entity-hero-poster" loading="eager" />
            ) : (
              <div className="entity-hero-poster placeholder" aria-hidden>
                {displayLabel.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="entity-hero-copy">
            <div className="entity-hero-toolbar">
              <button type="button" className="eh-btn ghost entity-hero-back" onClick={onOpenGraph}>
                ← Graph
              </button>
              {enriching && <span className="dossier-enriching-pill">Updating…</span>}
            </div>

            <div className="entity-hero-tags">
              {tags.map((t) => (
                <span key={t} className="entity-hero-tag">
                  {t}
                </span>
              ))}
            </div>

            <h1 className="entity-hero-title">
              {displayLabel}
              <span className="kg-verified" title="Verified entity" aria-label="Verified">
                ✓
              </span>
            </h1>

            {dossier.hero.subtitle && <p className="entity-hero-subtitle work">{dossier.hero.subtitle}</p>}

            {dossier.hero.factPills.length > 0 && (
              <div className="entity-hero-pills">
                {dossier.hero.factPills.map((p) => (
                  <div key={p.label} className="entity-hero-pill">
                    <span className="entity-hero-pill-icon" aria-hidden>
                      {PILL_ICONS[p.label] ?? '•'}
                    </span>
                    <div>
                      <em>{p.label}</em>
                      <strong>{p.value}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {intro && <p className="entity-hero-bio entity-hero-lead">{intro}</p>}

        {workData.heroMetrics.length > 0 && (
          <div className="entity-hero-metrics">
            {workData.heroMetrics.slice(0, 4).map((m) => (
              <div key={m.label} className="entity-hero-metric">
                <span className="entity-hero-metric-icon" aria-hidden>
                  {METRIC_ICONS[m.icon]}
                </span>
                <div>
                  <strong>{m.value}</strong>
                  <span>{m.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
