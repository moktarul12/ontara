import type { EntityDossier } from '../../types/entityDossier'
import {
  visibleOverviewSections,
  type OverviewSectionId,
} from '../../services/overviewSections'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'
import { HorizontalTimeline } from './HorizontalTimeline'
import { TopicCardGrid } from './TopicCardGrid'
import { WikiArticlePreview } from './MultiSourceBlocks'
import { buildTopicCards } from './OverviewSectionBodies'
import { timelineNarrativeIntro } from '../../utils/timelineEnrich'

export function OverviewSummaryHub({
  dossier,
  onSection,
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
    <div className="corpus-topic-body" id="ke-section-overview">
      {workData && workData.cast.length > 0 && (
        <section className="ke-panel corpus-cast-panel" id="cat-cast">
          <header className="ke-panel-head">
            <h2>Cast ({workData.cast.length})</h2>
            <button type="button" className="ke-link-btn" onClick={() => onSection('cast')}>
              View all →
            </button>
          </header>
          <div className="corpus-cast-rail">
            {workData.cast.slice(0, 10).map((member, i) => (
              <article key={`${member.name}-${i}`} className="corpus-cast-member">
                {member.imageUrl ? (
                  <img src={member.imageUrl} alt="" className="corpus-cast-photo" loading="lazy" />
                ) : (
                  <div className="corpus-cast-avatar" aria-hidden>
                    {member.name.slice(0, 1)}
                  </div>
                )}
                <strong>{member.name}</strong>
                {member.role && <span>{member.role}</span>}
              </article>
            ))}
          </div>
        </section>
      )}

      {orgData && orgData.products.length > 0 && (
        <section className="ke-panel" id="cat-products">
          <header className="ke-panel-head">
            <h2>What {dossier.label} does</h2>
            <button type="button" className="ke-link-btn" onClick={() => onSection('products')}>
              View all →
            </button>
          </header>
          <div className="corpus-product-grid">
            {orgData.products.map((p) => (
              <span key={p.name} className="corpus-product-chip">
                {p.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {dossier.summary.topAwards.length > 0 && (
        <section className="ke-panel" id="cat-honours">
          <header className="ke-panel-head">
            <h2>Awards &amp; recognition</h2>
            <button type="button" className="ke-link-btn" onClick={() => onSection('honours')}>
              View all →
            </button>
          </header>
          <ul className="corpus-award-list">
            {dossier.summary.topAwards.slice(0, 6).map((a, i) => (
              <li key={`${a.name}-${i}`}>
                <span aria-hidden>★</span>
                <div>
                  <strong>{a.name}</strong>
                  {a.year && <em>{a.year}</em>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.length > 0 && (
        <div id="ke-section-timeline">
          <HorizontalTimeline
            items={timeline}
            narrative={timelineNarrativeIntro(dossier, timeline)}
            onSeeAll={() => onSection('timeline')}
          />
        </div>
      )}

      {works.length > 0 && (
        <section className="ke-panel" id="cat-works">
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
