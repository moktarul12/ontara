import type { EntityDossier } from '../../types/entityDossier'

export function RelatedKnowledge({
  dossier,
  onOpenGraph,
  limit = 8,
  onSeeAll,
}: {
  dossier: EntityDossier
  onOpenGraph: () => void
  limit?: number
  onSeeAll?: () => void
}) {
  const items = [
    ...dossier.summary.topWorks.map((w) => ({
      key: w.title,
      label: w.title,
      sub: w.year ?? w.role ?? 'Work',
      imageUrl: w.imageUrl,
    })),
    ...dossier.family.members.slice(0, 4).map((m) => ({
      key: `${m.relation}-${m.name}`,
      label: m.name,
      sub: m.relation,
      imageUrl: m.imageUrl,
    })),
    ...dossier.summary.familyPreview
      .filter((m) => !dossier.family.members.some((f) => f.name === m.name))
      .slice(0, 3)
      .map((m) => ({
        key: `prev-${m.name}`,
        label: m.name,
        sub: m.relation,
        imageUrl: m.imageUrl,
      })),
  ].slice(0, limit)

  if (!items.length) return null

  return (
    <section className="kx-section kx-related" id="cat-related">
      <header className="kx-section-head kx-related-head">
        <div>
          <h2>Related Knowledge</h2>
          <p>Explore connected people, works, and entities in the knowledge graph.</p>
        </div>
        <button
          type="button"
          className="kx-btn-ghost"
          onClick={onSeeAll ?? onOpenGraph}
        >
          {onSeeAll ? 'See all →' : 'Open graph →'}
        </button>
      </header>
      <div className="kx-related-grid">
        {items.map((item) => (
          <article key={item.key} className="kx-related-card">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" className="kx-related-img" loading="lazy" />
            ) : (
              <div className="kx-related-img placeholder" aria-hidden>
                {item.label.slice(0, 1)}
              </div>
            )}
            <div>
              <strong>{item.label}</strong>
              <span>{item.sub}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
