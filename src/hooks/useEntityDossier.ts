import { useEffect, useState } from 'react'
import { buildEntityDossier } from '../services/dossierBuilder'
import { enrichDossierWithImages } from '../services/dossierEnrich'
import { enrichEntityCardShell, fetchEntityCardShell } from '../services/entityCardShell'
import { buildAiCategoryContent } from '../services/aiContentService'
import { enrichDossierWithAiProfile } from '../services/aiEntityProfileService'
import type { EntityDossier } from '../types/entityDossier'
import type { SparqlSourceId } from '../types/ontology'

export function useEntityDossier(
  uri: string | undefined,
  _primarySource: SparqlSourceId,
  lang: string,
) {
  const [dossier, setDossier] = useState<EntityDossier | null>(null)
  const [loading, setLoading] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!uri) {
      setDossier(null)
      setLoading(false)
      setEnriching(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setEnriching(false)
      setErr(null)
      try {
        const shell = await fetchEntityCardShell(uri, lang)
        const initial = buildEntityDossier(shell.article, shell.profile, false)
        const initialWithImages = await enrichDossierWithImages(
          initial,
          shell.profile,
          shell.wiki?.leadImage,
        )
        if (!cancelled) {
          setDossier(initialWithImages)
          setLoading(false)
        }

        setEnriching(true)
        const enriched = await enrichEntityCardShell(shell, lang)
        const full = buildEntityDossier(enriched.article, enriched.profile, true)
        const fullWithImages = await enrichDossierWithImages(
          full,
          enriched.profile,
          enriched.wiki?.leadImage,
        )
        const categoryContent = await buildAiCategoryContent(
          fullWithImages,
          fullWithImages.summary.verifiedFacts,
        )
        let withCategory = categoryContent
          ? { ...fullWithImages, categoryContent }
          : fullWithImages
        withCategory = await enrichDossierWithAiProfile(withCategory)
        if (!cancelled) {
          setDossier(withCategory)
          setEnriching(false)
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

  return { dossier, loading, enriching, err }
}
