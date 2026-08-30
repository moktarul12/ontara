import type { EntityKind } from '../../types/entityArticle'
import type { EntityDossier } from '../../types/entityDossier'
import { buildPersonDashboardData } from '../../services/personDashboardBuilder'
import { buildOrgDashboardData } from '../../services/orgDashboardBuilder'
import { buildWorkDashboardData } from '../../services/workDashboardBuilder'
import { PersonHero } from '../dossier/PersonHero'
import { OrgHero } from '../dossier/OrgHero'
import { WorkHero } from '../dossier/WorkHero'

export function EntityReaderHero({
  kind,
  dossier,
  displayLabel,
  enriching,
  onOpenGraph,
}: {
  kind: EntityKind
  dossier: EntityDossier
  displayLabel: string
  enriching?: boolean
  onOpenGraph: () => void
}) {
  if (kind === 'person') {
    return (
      <PersonHero
        dossier={dossier}
        displayLabel={displayLabel}
        personData={buildPersonDashboardData(dossier)}
        enriching={enriching}
        onOpenGraph={onOpenGraph}
      />
    )
  }
  if (kind === 'org') {
    return (
      <OrgHero
        dossier={dossier}
        displayLabel={displayLabel}
        orgData={buildOrgDashboardData(dossier)}
        enriching={enriching}
        onOpenGraph={onOpenGraph}
      />
    )
  }
  if (kind === 'work') {
    return (
      <WorkHero
        dossier={dossier}
        displayLabel={displayLabel}
        workData={buildWorkDashboardData(dossier)}
        enriching={enriching}
        onOpenGraph={onOpenGraph}
      />
    )
  }

  const subtitle = dossier.aiProfile?.summary.hook ?? dossier.hero.subtitle
  return (
    <section className="entity-hero-wrap generic-hero-wrap">
      <article className="entity-hero-card">
        <h1 className="entity-hero-title">{displayLabel}</h1>
        {subtitle && <p className="entity-hero-subtitle">{subtitle}</p>}
      </article>
    </section>
  )
}
