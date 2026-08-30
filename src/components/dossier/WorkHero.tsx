import type { EntityDossier, HeroMetric } from '../../types/entityDossier'
import type { WorkDashboardData } from '../../services/workDashboardBuilder'

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

function truncateBio(text: string, max = 220): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const last = cut.lastIndexOf(' ')
  return `${(last > 80 ? cut.slice(0, last) : cut).trim()}…`
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
  const intro = dossier.hero.intro
  const tags = workData.genreTags.length
    ? ['Film', ...workData.genreTags.slice(0, 2), 'Wikidata']
    : ['Work', 'Wikidata']

  return (
    <section className="entity-hero-wrap work-hero-wrap" id="cat-profile" aria-label="Film profile">
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
            {intro && <p className="entity-hero-bio">{truncateBio(intro)}</p>}

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
