import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import {
  overviewSectionCount,
  type OverviewSectionDef,
} from '../../services/overviewSections'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'
import { RelatedKnowledge } from '../composition/RelatedKnowledge'
import { SourcesProvenance } from '../composition/SourcesProvenance'
import { InfoboxPanel } from './InfoboxPanel'
import { ExternalLinksPanel, WikipediaArticlePanel, WikipediaSectionPanel } from './WikipediaPanels'
import { CorpusYearTimeline } from './CorpusYearTimeline'
import { CorpusDataPanel } from './CorpusDataPanel'

const SOURCE_LABELS: Record<string, string> = {
  wikidata: 'Wikidata',
  wikipedia: 'Wikipedia',
  dbpedia: 'DBpedia',
}

function PersonDetailCard({ card }: { card: ReturnType<typeof buildPersonDashboardData>['detailCards'][0] }) {
  return (
    <article className={`person-detail-card ${card.status}`}>
      <div className="person-detail-head">
        <span>{card.label}</span>
        {card.status === 'confirmed' ? (
          <span className="person-verified-badge">✓ verified</span>
        ) : (
          <span className="person-reported-badge">reported</span>
        )}
      </div>
      <strong>{card.value}</strong>
      <div className="person-detail-sources">
        {card.sources.map((s) => (
          <span key={s} className={`person-source-chip source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
    </article>
  )
}

function WorkDetailCard({ card }: { card: ReturnType<typeof buildWorkDashboardData>['detailCards'][0] }) {
  return (
    <article className={`film-detail-card ${card.status}`}>
      <div className="film-detail-head">
        <span>{card.label}</span>
        {card.status === 'confirmed' ? (
          <span className="film-verified-badge">✓ verified</span>
        ) : (
          <span className="film-reported-badge">reported</span>
        )}
      </div>
      <strong>{card.value}</strong>
      <div className="film-detail-sources">
        {card.sources.map((s) => (
          <span key={s} className={`film-source-chip source-${s}`}>
            {SOURCE_LABELS[s] ?? s}
          </span>
        ))}
      </div>
    </article>
  )
}

function OrgRevenueChart({ points }: { points: ReturnType<typeof buildOrgDashboardData>['financialPoints'] }) {
  if (!points.length) return null
  return (
    <div className="org-revenue-chart">
      <div className="org-chart-bars">
        {points.map((p) => (
          <div key={p.label} className="org-chart-bar-wrap">
            <div className="org-chart-bar" style={{ height: `${p.pct}%` }} title={p.display} />
            <span className="org-chart-label">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function renderOverviewSection(
  sectionId: OverviewSectionId,
  dossier: EntityDossier,
  onOpenGraph: () => void,
) {
  const wiki = dossier.wikipedia

  if (wiki) {
    switch (sectionId) {
      case 'infobox':
        return (
          <InfoboxPanel
            rows={wiki.infobox}
            label={dossier.label}
            kind={dossier.kind}
            imageUrl={dossier.hero.imageUrl}
          />
        )
      case 'article':
        return <WikipediaArticlePanel sections={wiki.sections} />
      case 'plot':
        return (
          <WikipediaSectionPanel
            sections={wiki.sections}
            pattern={/plot|synopsis|story|premise/i}
            fallbackTitle="Plot"
          />
        )
      case 'external':
        return <ExternalLinksPanel links={wiki.externalLinks} categories={wiki.categories} />
      case 'filmography':
        return renderFilmographySection(dossier)
    }
  }

  if (dossier.kind === 'person') return renderPersonSection(sectionId, dossier, onOpenGraph)
  if (dossier.kind === 'org') return renderOrgSection(sectionId, dossier, onOpenGraph)
  if (dossier.kind === 'work') return renderWorkSection(sectionId, dossier, onOpenGraph)
  return null
}

function renderFilmographySection(dossier: EntityDossier) {
  const tables =
    dossier.wikipedia?.sections.flatMap((s) => {
      const walk = (sec: typeof s): import('../../types/entityArticle').ArticleTable[] => [
        ...(sec.tables ?? []),
        ...sec.children.flatMap(walk),
      ]
      return walk(s)
    }) ?? []

  const filmTable = tables.find((t) => /filmography|discography|works/i.test(t.title))

  return (
    <section className="person-card kx-chapter">
      {filmTable && (
        <div className="wiki-table-wrap">
          <h4 className="wiki-table-title">{filmTable.title}</h4>
          <table className="wiki-table">
            <thead>
              <tr>
                {filmTable.columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filmTable.rows.map((row, i) => (
                <tr key={i}>
                  {filmTable.columns.map((c) => (
                    <td key={c.key}>{row[c.key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="person-film-rail">
        {dossier.works.items.map((w, i) => (
          <article key={`${w.title}-${i}`} className="person-film-card">
            {w.imageUrl ? (
              <img src={w.imageUrl} alt="" className="person-film-poster" loading="lazy" />
            ) : (
              <div className="person-film-poster placeholder" aria-hidden>
                {w.title.slice(0, 1)}
              </div>
            )}
            <strong>{w.title}</strong>
            {w.year && <span>{w.year}</span>}
            {w.role && <span>{w.role}</span>}
          </article>
        ))}
      </div>
    </section>
  )
}

function renderPersonSection(
  sectionId: OverviewSectionId,
  dossier: EntityDossier,
  onOpenGraph: () => void,
) {
  const data = buildPersonDashboardData(dossier)

  switch (sectionId) {
    case 'ai':
      return null
    case 'facts':
      return <CorpusDataPanel dossier={dossier} />
    case 'details':
      return (
        <section className="person-card kx-chapter">
          <div className="person-detail-grid">
            {data.detailCards.map((c) => (
              <PersonDetailCard key={c.label} card={c} />
            ))}
          </div>
        </section>
      )
    case 'career':
      return (
        <section className="person-card kx-chapter">
          <div className="person-phase-rail">
            {dossier.summary.careerEras.map((era, i) => (
              <article key={`${era.title}-${i}`} className="person-phase-chip">
                {era.era && <time>{era.era}</time>}
                <span>{era.title}</span>
                {era.description && <p className="kx-chapter-note">{era.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )
    case 'works':
      return (
        <section className="person-card kx-chapter">
          <div className="person-film-rail">
            {dossier.summary.topWorks.map((w, i) => (
              <article key={`${w.title}-${i}`} className="person-film-card">
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt="" className="person-film-poster" loading="lazy" />
                ) : (
                  <div className="person-film-poster placeholder" aria-hidden>
                    {w.title.slice(0, 1)}
                  </div>
                )}
                <strong>{w.title}</strong>
                {w.year && <span>{w.year}</span>}
              </article>
            ))}
          </div>
        </section>
      )
    case 'honours':
      return (
        <section className="person-card kx-chapter">
          <ul className="person-award-list">
            {dossier.summary.topAwards.map((a, i) => (
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
      )
    case 'timeline':
      return <CorpusYearTimeline dossier={dossier} />
    case 'family':
      return (
        <section className="person-aside-card kx-chapter kx-chapter-wide">
          <ul className="person-family-list">
            {dossier.family.members.map((m, i) => (
              <li key={`${m.relation}-${m.name}-${i}`}>
                {m.imageUrl ? (
                  <img src={m.imageUrl} alt="" className="person-family-photo" loading="lazy" />
                ) : (
                  <div className="person-family-avatar" aria-hidden>
                    {m.name.slice(0, 1)}
                  </div>
                )}
                <div>
                  <span>{m.relation}</span>
                  <strong>{m.name}</strong>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'related':
      return <RelatedKnowledge dossier={dossier} onOpenGraph={onOpenGraph} />
    case 'sources':
      return <SourcesProvenance dossier={dossier} />
    default:
      return null
  }
}

function renderOrgSection(sectionId: OverviewSectionId, dossier: EntityDossier, onOpenGraph: () => void) {
  const data = buildOrgDashboardData(dossier)

  switch (sectionId) {
    case 'ai':
      return null
    case 'facts':
      return <CorpusDataPanel dossier={dossier} />
    case 'details':
      return dossier.wikipedia?.infobox.length ? (
        <InfoboxPanel
          rows={dossier.wikipedia.infobox}
          label={dossier.label}
          kind={dossier.kind}
          imageUrl={dossier.hero.imageUrl}
        />
      ) : (
        <section className="org-highlights kx-chapter">
          {dossier.summary.verifiedFacts.slice(0, 20).map((f) => (
            <article key={f.label} className="org-highlight-card">
              <span className="org-highlight-label">{f.label}</span>
              <strong>{f.value}</strong>
            </article>
          ))}
        </section>
      )
    case 'financials':
      return (
        <section className="org-card org-financial-card kx-chapter">
          <div className="org-fin-metrics">
            {data.heroMetrics
              .filter((m) => /revenue|income|cap|employees/i.test(m.label))
              .map((m) => (
                <article key={m.label} className="org-fin-metric">
                  <span>{m.label}</span>
                  <strong>{m.value}</strong>
                </article>
              ))}
          </div>
          {data.financialPoints.length > 1 && <OrgRevenueChart points={data.financialPoints} />}
        </section>
      )
    case 'products':
      return (
        <section className="org-card org-products-card kx-chapter">
          <div className="org-product-list">
            {data.products.map((p) => (
              <article key={p.name} className="org-product-item">
                <span className="org-product-dot" aria-hidden />
                <strong>{p.name}</strong>
              </article>
            ))}
          </div>
        </section>
      )
    case 'leadership':
      return (
        <section className="org-card kx-chapter">
          <ul className="org-people-list org-people-main">
            {data.keyPeople.map((p) => (
              <li key={p.name}>
                <div className="org-person-avatar" aria-hidden>
                  {p.name.slice(0, 1)}
                </div>
                <div>
                  <strong>{p.name}</strong>
                  <span>{p.role}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )
    case 'history':
      return <CorpusYearTimeline dossier={dossier} />
    case 'honours':
      return (
        <section className="org-card org-awards-card kx-chapter">
          <ul className="org-award-list">
            {dossier.summary.topAwards.map((a, i) => (
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
      )
    case 'related':
      return <RelatedKnowledge dossier={dossier} onOpenGraph={onOpenGraph} />
    case 'sources':
      return <SourcesProvenance dossier={dossier} />
    default:
      return null
  }
}

function renderWorkSection(sectionId: OverviewSectionId, dossier: EntityDossier, onOpenGraph: () => void) {
  const data = buildWorkDashboardData(dossier)

  switch (sectionId) {
    case 'ai':
      return null
    case 'facts':
      return <CorpusDataPanel dossier={dossier} />
    case 'details':
      return (
        <section className="film-card kx-chapter">
          <div className="film-detail-grid">
            {data.detailCards.map((c) => (
              <WorkDetailCard key={c.label} card={c} />
            ))}
          </div>
          {dossier.summary.quote && (
            <blockquote className="film-trivia">
              <span className="film-trivia-label">💡 Did you know?</span>
              <p>{dossier.summary.quote}</p>
            </blockquote>
          )}
        </section>
      )
    case 'cast':
      return (
        <section className="film-card film-cast-card kx-chapter">
          <div className="film-cast-rail">
            {data.cast.map((member, i) => (
              <article key={member.name} className="film-cast-member">
                {member.imageUrl ? (
                  <img src={member.imageUrl} alt="" className="film-cast-photo" loading="lazy" />
                ) : (
                  <div className="film-cast-avatar" aria-hidden>
                    {member.name.slice(0, 1)}
                  </div>
                )}
                <span className="film-cast-rank">{i + 1}</span>
                <strong>{member.name}</strong>
                {member.role && <span>{member.role}</span>}
              </article>
            ))}
          </div>
        </section>
      )
    case 'honours':
      return (
        <section className="film-card kx-chapter">
          <ul className="film-award-list">
            {dossier.summary.topAwards.map((a, i) => (
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
      )
    case 'timeline':
      return <CorpusYearTimeline dossier={dossier} />
    case 'related':
      return <RelatedKnowledge dossier={dossier} onOpenGraph={onOpenGraph} />
    case 'sources':
      return <SourcesProvenance dossier={dossier} />
    default:
      return null
  }
}

export function buildTopicCards(dossier: EntityDossier, sections: OverviewSectionDef[]) {
  const data =
    dossier.kind === 'person'
      ? buildPersonDashboardData(dossier)
      : dossier.kind === 'org'
        ? buildOrgDashboardData(dossier)
        : dossier.kind === 'work'
          ? buildWorkDashboardData(dossier)
          : null

  return sections
    .filter((s) => s.group === 'learn' || s.group === 'wiki')
    .map((s) => {
      let preview: string | undefined
      if (s.id === 'works' && dossier.summary.topWorks[0]) {
        preview = dossier.summary.topWorks.slice(0, 2).map((w) => w.title).join(', ')
      }
      if (s.id === 'career' && dossier.summary.careerEras[0]) {
        preview = dossier.summary.careerEras[0].title
      }
      if (s.id === 'cast' && data && 'cast' in data && data.cast[0]) {
        preview = data.cast.slice(0, 2).map((c) => c.name).join(', ')
      }
      if (s.id === 'leadership' && data && 'keyPeople' in data && data.keyPeople[0]) {
        preview = data.keyPeople[0].name
      }
      if (s.group === 'wiki') {
        preview = s.previewHint?.(dossier)
      }

      return {
        sectionId: s.id,
        icon: s.icon,
        title: s.navLabel,
        description: s.description,
        hint: s.previewHint?.(dossier),
        count: overviewSectionCount(dossier, s.id),
        preview,
      }
    })
}

export function renderSummaryFactsPreview(dossier: EntityDossier, limit = 6) {
  if (dossier.kind === 'person') {
    const data = buildPersonDashboardData(dossier)
    const items = data.highlights.length
      ? data.highlights.map((h) => ({ label: h.label, value: h.value, icon: '✦' }))
      : dossier.summary.storyBeats.map((b) => ({ label: b.label, value: b.detail, icon: b.icon }))
    if (!items.length) return null
    return (
      <section className="person-glance kx-hub-facts">
        <p className="person-section-label">At a glance</p>
        <div className="person-glance-grid">
          {items.slice(0, limit).map((h) => (
            <article key={h.label} className="person-glance-card verified">
              <span aria-hidden>{h.icon}</span>
              <div>
                <em>{h.label}</em>
                <strong>{h.value}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    )
  }

  if (dossier.kind === 'org') {
    const data = buildOrgDashboardData(dossier)
    if (!data.highlights.length) return null
    return (
      <section className="org-highlights kx-hub-facts">
        {data.highlights.slice(0, limit).map((h) => (
          <article key={h.label} className="org-highlight-card">
            <span className="org-highlight-label">{h.label}</span>
            <strong>{h.value}</strong>
          </article>
        ))}
      </section>
    )
  }

  if (dossier.kind === 'work') {
    const data = buildWorkDashboardData(dossier)
    if (!data.keyStats.length) return null
    return (
      <section className="film-key-stats kx-hub-facts">
        {data.keyStats.slice(0, limit).map((s) => (
          <article key={s.label} className="film-key-stat">
            <span className="film-key-icon" aria-hidden>
              {s.icon}
            </span>
            <div>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          </article>
        ))}
      </section>
    )
  }

  return null
}
