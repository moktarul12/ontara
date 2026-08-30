import type { EntityDossier } from '../../types/entityDossier'

export function SourceTrustBar({ dossier }: { dossier: EntityDossier }) {
  const trust = dossier.summary.sourceTrust
  if (!trust.totalFacts) return null

  const pct = Math.round((trust.confirmedCount / Math.max(trust.totalFacts, 1)) * 100)

  return (
    <div className="kx-trust-bar" role="status">
      <div className="kx-trust-bar-copy">
        <strong>Multi-source knowledge</strong>
        <span>
          {trust.totalFacts} facts · {trust.confirmedCount} confirmed · {trust.sources.length} sources
        </span>
      </div>
      <div className="kx-trust-meter" aria-hidden>
        <div className="kx-trust-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="kx-trust-sources">
        {trust.sources.map((s) => (
          <span key={s} className={`kx-source-chip source-${s}`}>
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
