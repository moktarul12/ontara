import type { OverviewSectionId } from '../../services/overviewSections'

export type TopicCard = {
  sectionId: OverviewSectionId
  icon: string
  title: string
  description: string
  hint?: string
  count?: number
  preview?: string
}

export function TopicCardGrid({
  cards,
  onSelect,
}: {
  cards: TopicCard[]
  onSelect: (id: OverviewSectionId) => void
}) {
  if (!cards.length) return null

  return (
    <section className="kx-topic-section" aria-label="Explore this topic">
      <header className="kx-topic-section-head">
        <h2>Explore this topic</h2>
        <p>Go deeper — each section is a focused reading experience</p>
      </header>
      <div className="kx-topic-grid">
        {cards.map((card) => (
          <button
            key={card.sectionId}
            type="button"
            className="kx-topic-card"
            onClick={() => onSelect(card.sectionId)}
          >
            <span className="kx-topic-icon" aria-hidden>
              {card.icon}
            </span>
            <div className="kx-topic-body">
              <div className="kx-topic-title-row">
                <strong>{card.title}</strong>
                {card.count !== undefined && card.count > 0 && (
                  <span className="kx-topic-count">{card.count}</span>
                )}
              </div>
              <span className="kx-topic-desc">{card.description}</span>
              {(card.preview || card.hint) && (
                <span className="kx-topic-preview">{card.preview ?? card.hint}</span>
              )}
            </div>
            <span className="kx-topic-chevron" aria-hidden>
              →
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
