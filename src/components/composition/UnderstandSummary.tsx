import type { EntityDossier } from '../../types/entityDossier'
import { resolveSummaryNarrative } from '../../utils/dossierNarrative'

export function UnderstandSummary({
  dossier,
  imageUrl,
  loading = false,
}: {
  dossier: EntityDossier
  imageUrl?: string
  loading?: boolean
}) {
  const narrative = resolveSummaryNarrative(dossier)
  const aiSource = dossier.aiProfile?.source ?? dossier.categoryContent?.source
  const trust = dossier.summary.sourceTrust

  if (!narrative && !loading) return null

  return (
    <section className="kx-section kx-understand" id="cat-summary">
      <header className="kx-section-head kx-understand-head">
        <div>
          <span className="kx-eyebrow">Understand in 30 seconds</span>
          <h2>AI-assisted summary</h2>
          <p className="kx-section-sub">
            {loading && !narrative
              ? 'Synthesizing a quick overview from verified sources…'
              : aiSource === 'llm' || aiSource === 'cache'
                ? 'Creative AI editorial — full profile cached for instant reload'
                : aiSource === 'hybrid'
                  ? 'Synthesized from verified facts across multiple sources'
                  : 'Cross-verified from Wikidata, Wikipedia & DBpedia, rewritten for clarity'}
          </p>
        </div>
        {imageUrl && (
          <div className="kx-understand-watermark" style={{ backgroundImage: `url(${imageUrl})` }} aria-hidden />
        )}
      </header>
      {narrative ? (
        <p className="kx-understand-text">{narrative}</p>
      ) : (
        <p className="kx-understand-text kx-understand-loading muted" aria-busy="true">
          Building your 30-second overview…
        </p>
      )}
      <footer className="kx-understand-foot">
        <span className="kx-trust-pill confirmed">{trust.confirmedCount} confirmed</span>
        {trust.reportedCount > 0 && (
          <span className="kx-trust-pill reported">{trust.reportedCount} reported</span>
        )}
        <span className="kx-trust-pill sources">{trust.sources.join(' · ')}</span>
      </footer>
    </section>
  )
}
