import { useCallback, useEffect, useRef, useState } from 'react'
import { buildEntityDossier } from '../services/dossierBuilder'
import { enrichDossierWithImages } from '../services/dossierEnrich'
import { enrichEntityCardShell, fetchEntityCardShell, type CardShell } from '../services/entityCardShell'
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
  return enrichDossierWithImages(built, shell.profile, leadImage ?? shell.wiki?.leadImage, {
    maxRelated: 12,
  })
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
  // AI profile only — skip synthesize category content (extra /api/ai/synthesize call).
  return enrichDossierWithAiProfile(dossier)
}

function isFastOverviewPlan(plan: ReturnType<typeof dossierLoadPlan>): boolean {
  return (
    !plan.includeSections &&
    !plan.includeTables &&
    !plan.fetchSupplement &&
    plan.skipFacets
  )
}

function scheduleIdle(fn: () => void, timeoutMs = 2500) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(() => fn(), { timeout: timeoutMs })
    return () => window.cancelIdleCallback(id)
  }
  const t = globalThis.setTimeout(fn, Math.min(timeoutMs, 800))
  return () => globalThis.clearTimeout(t)
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
    let cancelIdle: (() => void) | undefined
    const plan = dossierLoadPlan(sectionAtLoadRef.current)
    const backgroundPlan = dossierBackgroundEnrichPlan()
    const fastOverview = isFastOverviewPlan(plan)

    void (async () => {
      setLoading(true)
      setEnriching(false)
      setErr(null)
      try {
        // 1) One bundled shell call → paint overview immediately
        const shell = await fetchEntityCardShell(uri, lang)
        const built = buildEntityDossier(shell.article, shell.profile, true)
        const initial = withShellHeroImage(
          built,
          shell.profile.imageUrl ?? shell.wiki?.leadImage,
        )
        if (!cancelled) {
          setDossier(initial)
          setLoading(false)
        }

        // 2) Related portraits — deferred, capped (was N+1 Commons/SPARQL storms)
        cancelIdle = scheduleIdle(() => {
          if (cancelled) return
          void enrichDossierWithImages(
            built,
            shell.profile,
            shell.wiki?.leadImage,
            { maxRelated: 12 },
          ).then((withImages) => {
            if (!cancelled) {
              setDossier((d) =>
                d
                  ? withShellHeroImage(
                      withImages,
                      shell.profile.imageUrl ?? shell.wiki?.leadImage,
                    )
                  : d,
              )
            }
          })
        }, 1800)

        // 3) Fast summary: skip heavy SPARQL/tables/AI on open
        if (fastOverview) {
          // Optional light no-op enrich (uses shell cache) — no network when skipFacets
          void enrichShellToDossier(shell, lang, backgroundPlan).catch(() => {})
          return
        }

        // 4) Section-specific needs (filmography / sources / etc.)
        if (!cancelled) setEnriching(true)
        const withFacets = await enrichShellToDossier(shell, lang, plan)
        if (cancelled) return
        setDossier(withFacets)
        setEnriching(false)

        if (!plan.deferAi) {
          const final = await applyAiLayers(withFacets)
          if (!cancelled) setDossier(final)
        } else {
          scheduleIdle(() => {
            if (cancelled) return
            void applyAiLayers(withFacets)
              .then((final) => {
                if (!cancelled) setDossier(final)
              })
              .catch(() => {})
          }, 4000)
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
      cancelIdle?.()
    }
  }, [uri, lang])

  const patchDossier = useCallback((patch: (d: EntityDossier) => EntityDossier) => {
    setDossier((d) => (d ? patch(d) : d))
  }, [])

  return { dossier, loading, enriching, err, patchDossier }
}
