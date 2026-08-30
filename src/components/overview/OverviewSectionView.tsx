import type { EntityDossier } from '../../types/entityDossier'
import type { EntityKind } from '../../types/entityArticle'
import {
  adjacentOverviewSections,
  overviewSectionDef,
  type OverviewSectionId,
} from '../../services/overviewSections'
import {
  adjacentWikiSections,
  findWikiSectionByNavId,
  isWikiSectionId,
} from '../../services/wikiSectionNav'
import { mergeAiIntoWikiSection } from '../../services/applyAiEntityProfile'
import { renderOverviewSection } from './OverviewSectionBodies'
import { SectionNavFooter } from './SectionNavFooter'
import { WikiSectionView } from './WikiSectionView'

export function OverviewSectionView({
  kind,
  dossier,
  sectionId,
  onSection,
  onOpenGraph,
  compact = false,
}: {
  kind: EntityKind
  dossier: EntityDossier
  sectionId: OverviewSectionId
  onSection: (id: OverviewSectionId) => void
  onOpenGraph: () => void
  compact?: boolean
}) {
  if (isWikiSectionId(sectionId)) {
    const raw = findWikiSectionByNavId(dossier, sectionId)
    if (!raw) return null
    const section = mergeAiIntoWikiSection(dossier, raw, sectionId)
    const { prev, next } = adjacentWikiSections(dossier, sectionId)
    return (
      <WikiSectionView
        section={section}
        dossier={dossier}
        prev={prev}
        next={next}
        onSection={onSection}
      />
    )
  }

  const def = overviewSectionDef(kind, sectionId, dossier)
  const body = renderOverviewSection(sectionId, dossier, onOpenGraph)
  const { prev, next } = adjacentOverviewSections(kind, dossier, sectionId)

  if (!def || !body) return null

  if (compact) {
    return (
      <div className="or-section-body">
        {body}
        <SectionNavFooter prev={prev} next={next} onSection={onSection} />
      </div>
    )
  }

  return (
    <article className="kx-section-view">
      <header className="kx-section-view-head">
        <span className="kx-eyebrow">{def.navLabel}</span>
        <h2>{def.title}</h2>
        <p>{def.description}</p>
      </header>
      <div className="kx-section-view-body">{body}</div>
      <SectionNavFooter prev={prev} next={next} onSection={onSection} />
    </article>
  )
}
