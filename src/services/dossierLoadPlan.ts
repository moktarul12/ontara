import type { OverviewSectionId } from './overviewSections'
import { isWikiSectionId } from './wikiSectionNav'

const LIGHT_SECTIONS = new Set<OverviewSectionId>([
  'sources',
  'facts',
  'external',
  'infobox',
  'details',
])

export type DossierLoadPlan = {
  /** Full Wikipedia section bodies (slow — many API calls). */
  includeSections: boolean
  /** SPARQL filmography / awards tables. */
  includeTables: boolean
  /** Wikipedia external links & categories (fast). */
  fetchSupplement: boolean
  /** Defer OpenAI/Gemini profile to background. */
  deferAi: boolean
  /** Skip SPARQL facet queries (sources page only needs URLs). */
  skipFacets: boolean
}

/** Decide what to fetch up front vs in the background based on the URL section. */
export function dossierLoadPlan(section?: OverviewSectionId): DossierLoadPlan {
  if (!section || section === 'summary') {
    return {
      includeSections: false,
      includeTables: false,
      fetchSupplement: false,
      deferAi: true,
      skipFacets: true,
    }
  }

  if (isWikiSectionId(section)) {
    return {
      includeSections: false,
      includeTables: false,
      fetchSupplement: false,
      deferAi: true,
      skipFacets: false,
    }
  }

  if (LIGHT_SECTIONS.has(section)) {
    return {
      includeSections: false,
      includeTables: false,
      fetchSupplement: section === 'sources' || section === 'external',
      deferAi: true,
      skipFacets: section === 'sources' || section === 'external',
    }
  }

  return {
    includeSections: false,
    includeTables: section === 'filmography' || section === 'honours' || section === 'works',
    fetchSupplement: false,
    deferAi: true,
    skipFacets: false,
  }
}

export function dossierBackgroundEnrichPlan(): DossierLoadPlan {
  // Keep idle enrich light — tables/supplement/facets load when those sections need them.
  return {
    includeSections: false,
    includeTables: false,
    fetchSupplement: false,
    deferAi: true,
    skipFacets: true,
  }
}

/** Heavier enrich when user opens filmography / awards / sources. */
export function dossierSectionEnrichPlan(section?: OverviewSectionId): DossierLoadPlan {
  return dossierLoadPlan(section)
}
