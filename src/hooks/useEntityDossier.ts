import { useCallback, useEffect, useRef, useState } from 'react'
import { buildEntityDossier } from '../services/dossierBuilder'
import { enrichDossierWithImages } from '../services/dossierEnrich'
import { enrichEntityCardShell, fetchEntityCardShell, type CardShell } from '../services/entityCardShell'
import { buildAiCategoryContent } from '../services/aiContentService'
import { enrichDossierWithAiProfile } from '../services/aiEntityProfileService'
import { dossierBackgroundEnrichPlan, dossierLoadPlan } from '../services/dossierLoadPlan'
import type { OverviewSectionId } from '../services/overviewSections'
import type { EntityDossier } from '../types/entityDossier'
import type { SparqlSourceId } from '../types/ontology'

function withShellHeroImage(dossier: EntityDossier, imageUrl?: string): EntityDossier {
  if (!imageUrl || dossier.hero.imageUrl) return dossier
  return { ...dossier, hero: { ...dossier.hero, imageUrl } }
}

async function dossierFromShell(shell: CardShell, partial: boolean, leadImage?: string) {
  const built = buildEntityDossier(shell.article, shell.profile, !partial)
  return enrichDossierWithImages(built, shell.profile, leadImage ?? shell.wiki?.leadImage)
}

async function enrichShellToDossier(
  shell: CardShell,
  lang: string,
  plan: ReturnType<typeof dossierLoadPlan>,
) {
  const enriched = await enrichEntityCardShell(shell, lang, {
    includeSections: plan.includeSections,
    includeTables: plan.includeTables,
    fetchSupplement: plan.fetchSupplement,
    skipFacets: plan.skipFacets,
  })
  return dossierFromShell(enriched, false, enriched.wiki?.leadImage)
}

async function applyAiLayers(dossier: EntityDossier): Promise<EntityDossier> {
  const [categoryContent, withAi] = await Promise.all([
    buildAiCategoryContent(dossier, dossier.summary.verifiedFacts),
    enrichDossierWithAiProfile(dossier),
  ])
  return categoryContent ? { ...withAi, categoryContent } : withAi
}

function isFastOverviewPlan(plan: ReturnType<typeof dossierLoadPlan>): boolean {
  return (
    !plan.includeSections &&
    !plan.includeTables &&
    !plan.fetchSupplement &&
    plan.skipFacets
  )
}

export function useEntityDossier(
  uri: string | undefined,
  _primarySource: SparqlSourceId,
  lang: string,
  focusSection: OverviewSectionId = 'summary',
) {
  const [dossier, setDossier] = useState<EntityDossier | null>(null)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const sectionAtLoadRef = useRef(focusSection)

  useEffect(() => {
    sectionAtLoadRef.current = focusSection
  }, [uri, focusSection])

  useEffect(() => {
    if (!uri) {
      setDossier(null)
      setLoading(false)
      setEnriching(false)
      return
    }

    let cancelled = false
    const plan = dossierLoadPlan(sectionAtLoadRef.current)
    const backgroundPlan = dossierBackgroundEnrichPlan()
    const fastOverview = isFastOverviewPlan(plan)
    const needsBackgroundLater =
      !fastOverview &&
      (!plan.includeTables || !plan.fetchSupplement || plan.skipFacets)

    void (async () => {
      setLoading(true)
      setEnriching(false)
      setErr(null)
      try {
        const shell = await fetchEntityCardShell(uri, lang)
        const initial = withShellHeroImage(
          await dossierFromShell(shell, true),
          shell.profile.imageUrl ?? shell.wiki?.leadImage,
        )
        if (!cancelled) {
          setDossier(initial)
          setLoading(false)
          setEnriching(true)
        }

        const runAi = async (base: EntityDossier) => {
          const final = await applyAiLayers(base)
          if (!cancelled) {
            setDossier(final)
            setEnriching(false)
          }
        }

        if (fastOverview) {
          const fullDossier = await enrichShellToDossier(shell, lang, backgroundPlan)
          if (cancelled) return
          setDossier(fullDossier)
          if (backgroundPlan.deferAi) {
            void runAi(fullDossier).catch(() => {
              if (!cancelled) setEnriching(false)
            })
          } else {
            await runAi(fullDossier)
          }
          return
        }

        if (needsBackgroundLater) {
          void enrichShellToDossier(shell, lang, backgroundPlan)
            .then(async (fullDossier) => {
              if (cancelled) return
              setDossier(fullDossier)
              await runAi(fullDossier)
            })
            .catch(() => {
              if (!cancelled) setEnriching(false)
            })
          return
        }

        const withFacets = await enrichShellToDossier(shell, lang, plan)
        if (!cancelled) {
          setDossier(withFacets)
          if (plan.deferAi) {
            setEnriching(false)
          }
        }

        if (!plan.deferAi) {
          await runAi(withFacets)
        } else {
          void runAi(withFacets)
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load overview')
          setDossier(null)
          setLoading(false)
          setEnriching(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [uri, lang])

  const patchDossier = useCallback((patch: (d: EntityDossier) => EntityDossier) => {
    setDossier((d) => (d ? patch(d) : d))
  }, [])

  return { dossier, loading, enriching, err, patchDossier }
}
