import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { wikiOverviewSections } from '../../services/overviewSections'

export function MultiSourceFacts({ dossier }: { dossier: EntityDossier }) {
  const facts = dossier.summary.verifiedFacts.slice(0, 12)
  if (!facts.length) return null

  return (
    <section className="ke-panel ke-multisource">
      <header className="ke-panel-head">
        <h2>From multiple sources</h2>
        <p>Wikidata · Wikipedia · DBpedia cross-verified</p>
      </header>
      <div className="ke-multisource-grid">
        {facts.map((f) => (
          <article key={f.label} className={`ke-ms-fact ${f.status}`}>
            <div className="ke-ms-head">
              <span>{f.label}</span>
              <span className={`ke-ms-badge ${f.status}`}>
                {f.status === 'confirmed' ? 'confirmed' : 'reported'}
              </span>
            </div>
            <strong>{f.value}</strong>
            <div className="ke-ms-sources">
              {f.sources.map((s) => (
                <span key={s} className={`ke-source-chip source-${s}`}>
                  {s}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function WikiArticlePreview({
  dossier,
  onReadFull,
  onSection,
}: {
  dossier: EntityDossier
  onReadFull: () => void
  onSection?: (id: OverviewSectionId) => void
}) {
  const chapters = wikiOverviewSections(dossier.kind, dossier)
  const sections = dossier.wikipedia?.sections ?? []
  if (!sections.length && !chapters.length) return null

  const preview = chapters.slice(0, 6)

  return (
    <section className="ke-panel ke-wiki-preview">
      <header className="ke-panel-head">
        <div>
          <h2>Wikipedia article</h2>
          <p>
            {chapters.length > 0
              ? `${chapters.length} chapters — one per section, editorial rewrite`
              : `${sections.length} sections loaded from Wikipedia`}
          </p>
        </div>
        {chapters.length === 0 && (
          <button type="button" className="ke-link-btn" onClick={onReadFull}>
            Read full article →
          </button>
        )}
      </header>
      {preview.length > 0 ? (
        <div className="ke-wiki-chapter-grid">
          {preview.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className="ke-wiki-chapter-card"
              onClick={() => onSection?.(ch.id)}
            >
              <span className="ke-wiki-chapter-card-icon">{ch.icon}</span>
              <strong>{ch.navLabel}</strong>
              {ch.previewHint?.(dossier) && <span>{ch.previewHint(dossier)}</span>}
            </button>
          ))}
        </div>
      ) : (
        sections.slice(0, 3).map((s) => (
          <article key={s.id} className="ke-wiki-preview-section">
            <h3>{s.title}</h3>
            {s.paragraphs?.slice(0, 2).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </article>
        ))
      )}
      {chapters.length > 6 && (
        <button type="button" className="ke-link-btn block" onClick={() => onSection?.(chapters[6].id)}>
          + {chapters.length - 6} more chapters
        </button>
      )}
    </section>
  )
}
