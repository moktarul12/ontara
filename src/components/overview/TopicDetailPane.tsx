import { useEffect, useState } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { OverviewSectionView } from './OverviewSectionView'
import type { TopicCard } from './TopicCardGrid'

export function TopicDetailPane({
  kind,
  dossier,
  cards,
  onOpenGraph,
}: {
  kind: EntityKind
  dossier: EntityDossier
  cards: TopicCard[]
  onOpenGraph: () => void
}) {
  const [activeId, setActiveId] = useState<OverviewSectionId | null>(cards[0]?.sectionId ?? null)

  useEffect(() => {
    if (!cards.length) {
      setActiveId(null)
      return
    }
    if (!activeId || !cards.some((c) => c.sectionId === activeId)) {
      setActiveId(cards[0].sectionId)
    }
  }, [dossier.uri, cards, activeId])

  if (!cards.length || !activeId) return null

  const active = cards.find((c) => c.sectionId === activeId)

  return (
    <section className="corpus-topic-detail" aria-label="More details">
      <header className="corpus-topic-detail-head">
        <h2>More details</h2>
        <p>Structured data &amp; entity details</p>
      </header>

      <div className="corpus-reading-layout corpus-topic-detail-layout">
        <nav className="corpus-on-page" aria-label="Topic sections">
          <p className="corpus-on-page-label">Explore</p>
          <ul className="corpus-on-page-list">
            {cards.map((card) => {
              const selected = activeId === card.sectionId
              return (
                <li key={card.sectionId}>
                  <button
                    type="button"
                    className={`corpus-on-page-link ${selected ? 'active' : ''}`}
                    onClick={() => setActiveId(card.sectionId)}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <span className="corpus-topic-tab-icon" aria-hidden>
                      {card.icon}
                    </span>
                    <span className="corpus-topic-tab-label">{card.title}</span>
                    {card.count !== undefined && card.count > 0 && (
                      <span className="corpus-topic-tab-count">{card.count}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="corpus-reading-pane corpus-topic-detail-pane">
          {active && (
            <header className="corpus-topic-detail-pane-head">
              <h3>{active.title}</h3>
              <p>{active.description}</p>
            </header>
          )}
          <OverviewSectionView
            kind={kind}
            dossier={dossier}
            sectionId={activeId}
            onSection={setActiveId}
            onOpenGraph={onOpenGraph}
            compact
          />
        </div>
      </div>
    </section>
  )
}
