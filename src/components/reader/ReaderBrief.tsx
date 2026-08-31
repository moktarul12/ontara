import type { EntityDossier } from '../../types/entityDossier'
import { resolveSummaryNarrative } from '../../utils/dossierNarrative'

export function ReaderBrief({
  dossier,
  enriching,
}: {
  dossier: EntityDossier
  enriching?: boolean
}) {
  const text = resolveSummaryNarrative(dossier)
  const trust = dossier.summary.sourceTrust
  const fromAi = dossier.aiProfile?.source === 'llm' || dossier.aiProfile?.source === 'cache'
  const fromTemplate = dossier.aiProfile?.source === 'template'
  const aiError = dossier.aiProfile?.generationError

  return (
    <section className="or-brief" id="ke-section-overview">
      <div className="or-brief-inner">
        <p className="or-kicker">Understand in 30 seconds</p>
        {text ? (
          <p className="or-brief-lead">{text}</p>
        ) : (
          <p className="or-brief-lead or-shimmer" aria-busy={enriching}>
            {enriching ? 'Crafting your editorial summary…' : 'Summary loading…'}
          </p>
        )}
        <div className="or-brief-meta">
          <span className="or-pill verified">{trust.confirmedCount} verified facts</span>
          {fromAi && <span className="or-pill ai">OpenAI editorial</span>}
          {fromTemplate && <span className="or-pill template">Rule-based (not OpenAI)</span>}
          {!dossier.aiProfile && enriching && <span className="or-pill ai">Generating…</span>}
          <span className="or-pill muted">{trust.sources.join(' · ')}</span>
        </div>
        {fromTemplate && aiError && (
          <p className="or-brief-warn">
            OpenAI unavailable:{' '}
            {aiError.includes('credit') || aiError.includes('429')
              ? 'no API credits — add billing at platform.openai.com'
              : 'check API key / server logs'}
          </p>
        )}
      </div>
    </section>
  )
}
