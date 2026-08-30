import type { EntityDossier } from '../../types/entityDossier'
import {
  visibleOverviewSections,
  type OverviewSectionId,
} from '../../services/overviewSections'
import { UnderstandSummary } from '../composition/UnderstandSummary'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'
import { HorizontalTimeline } from './HorizontalTimeline'
import { TopicCardGrid } from './TopicCardGrid'
import { MultiSourceFacts, WikiArticlePreview } from './MultiSourceBlocks'
import { buildTopicCards, renderSummaryFactsPreview } from './OverviewSectionBodies'
import { timelineNarrativeIntro } from '../../utils/timelineEnrich'

export function OverviewSummaryHub({
  dossier,
  onSection,
  enriching = false,
}: {
  dossier: EntityDossier
  onSection: (id: OverviewSectionId) => void
  onOpenGraph: () => void
  enriching?: boolean
}) {
  const topicSections = visibleOverviewSections(dossier.kind, dossier).filter((s) => s.id !== 'summary')
  const topicCards = buildTopicCards(dossier, topicSections)

  const personData = dossier.kind === 'person' ? buildPersonDashboardData(dossier) : null
  const orgData = dossier.kind === 'org' ? buildOrgDashboardData(dossier) : null
  const workData = dossier.kind === 'work' ? buildWorkDashboardData(dossier) : null

  const timeline =
    personData?.timeline ??
    orgData?.timeline.map((m) => ({ year: m.year, label: m.label, detail: m.detail })) ??
    workData?.timeline ??
    []

  const works = dossier.summary.topWorks
  const worksTitle =
    dossier.kind === 'org' ? 'Products & brands' : dossier.kind === 'work' ? 'Related works' : 'Notable works'

  return (
    <div className="ke-overview-hub">
      <UnderstandSummary dossier={dossier} imageUrl={dossier.hero.imageUrl} loading={enriching} />

      <section className="ke-panel">
        <header className="ke-panel-head">
          <h2>Key facts</h2>
        </header>
        {renderSummaryFactsPreview(dossier, 4)}
      </section>

      <MultiSourceFacts dossier={dossier} />

      <HorizontalTimeline
        items={timeline}
        narrative={timeline.length ? timelineNarrativeIntro(dossier, timeline) : undefined}
        onSeeAll={() => onSection('timeline')}
      />

      {works.length > 0 && (
        <section className="ke-panel">
          <header className="ke-panel-head">
            <h2>{worksTitle}</h2>
            <button
              type="button"
              className="ke-link-btn"
              onClick={() =>
                onSection(dossier.kind === 'org' ? 'products' : dossier.kind === 'work' ? 'cast' : 'works')
              }
            >
              View all →
            </button>
          </header>
          <div className="ke-works-rail">
            {works.slice(0, 8).map((w, i) => (
              <article key={`${w.title}-${i}`} className="ke-work-card">
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt="" loading="lazy" />
                ) : (
                  <div className="placeholder" aria-hidden>
                    {w.title.slice(0, 1)}
                  </div>
                )}
                <strong>{w.title}</strong>
                {w.year && <span>{w.year}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      <WikiArticlePreview
        dossier={dossier}
        onReadFull={() => onSection('article')}
        onSection={onSection}
      />

      {topicCards.length > 0 && (
        <section className="ke-panel">
          <header className="ke-panel-head">
            <h2>More details</h2>
            <p>Sub-topics — full Wikipedia sections &amp; structured data</p>
          </header>
          <TopicCardGrid cards={topicCards} onSelect={onSection} />
        </section>
      )}
    </div>
  )
}
