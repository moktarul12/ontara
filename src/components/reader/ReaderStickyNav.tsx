import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { learnOverviewSections, wikiOverviewSections } from '../../services/overviewSections'

const ANCHORS = [
  { id: 'or-top', label: 'Top' },
  { id: 'or-brief', label: 'Summary' },
  { id: 'or-facts', label: 'Facts' },
  { id: 'or-timeline', label: 'Timeline' },
  { id: 'or-chapters', label: 'Chapters' },
]

export function ReaderStickyNav({
  kind,
  dossier,
  activeSection,
  onSection,
  onOpenGraph,
}: {
  kind: EntityKind
  dossier: EntityDossier
  activeSection: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  onOpenGraph: () => void
}) {
  const learn = learnOverviewSections(kind, dossier).filter((s) =>
    ['facts', 'timeline', 'sources', 'works', 'honours'].includes(s.id as string),
  )
  const wiki = wikiOverviewSections(kind, dossier)

  if (activeSection !== 'summary') {
    return (
      <nav className="or-sticky-nav or-sticky-nav-detail" aria-label="Reading">
        <button type="button" className="or-nav-back" onClick={() => onSection('summary')}>
          ← Back to overview
        </button>
        <button type="button" className="or-nav-ghost" onClick={onOpenGraph}>
          Graph
        </button>
      </nav>
    )
  }

  return (
    <nav className="or-sticky-nav" aria-label="On this story">
      <div className="or-sticky-scroll">
        {ANCHORS.map((a) => (
          <a key={a.id} href={`#${a.id}`} className="or-nav-pill">
            {a.label}
          </a>
        ))}
        {learn.slice(0, 3).map((s) => (
          <button key={s.id} type="button" className="or-nav-pill btn" onClick={() => onSection(s.id)}>
            {s.navLabel}
          </button>
        ))}
        {wiki.slice(0, 5).map((s) => (
          <button key={s.id} type="button" className="or-nav-pill btn wiki" onClick={() => onSection(s.id)}>
            {s.navLabel}
          </button>
        ))}
      </div>
      <button type="button" className="or-nav-ghost" onClick={onOpenGraph}>
        Explore graph
      </button>
    </nav>
  )
}
