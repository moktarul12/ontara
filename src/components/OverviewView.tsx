import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useEntityDossier } from '../hooks/useEntityDossier'
import {
  fetchEntityLanguageVariants,
  pickLanguageVariant,
  type EntityLanguageVariant,
} from '../services/entityLanguages'
import { canonicalEntityUri } from '../utils/entityUrl'
import { useOverviewSection } from '../hooks/useOverviewSection'
import { DossierView } from './dossier/DossierView'
import type { EntityTab } from './EntityHeader'

interface Props {
  store: OntologyStore
  contentLanguage: string
  onContentLanguageChange: (lang: string) => void
  onOpenGraph: () => void
  onLens: (tab: EntityTab) => void
}

export function OverviewView({
  store,
  contentLanguage,
  onContentLanguageChange,
  onOpenGraph,
  onLens,
}: Props) {
  const rawUri = store.pathRootId || store.config.seedUri
  const uri = rawUri ? canonicalEntityUri(rawUri, store.config.source) : undefined
  const { section, goToSection } = useOverviewSection(uri, store.config.source)
  const { dossier, loading, enriching, err, patchDossier } = useEntityDossier(
    uri,
    store.config.source,
    contentLanguage,
    section,
  )

  const [variants, setVariants] = useState<EntityLanguageVariant[]>([])

  useEffect(() => {
    if (!uri || loading || !dossier?.label) {
      if (!uri) setVariants([])
      return
    }
    let cancelled = false
    let idleCancel: (() => void) | undefined
    const label = dossier.label

    const run = () => {
      void (async () => {
        try {
          const list = await fetchEntityLanguageVariants(store.config.endpoint, uri)
          if (!cancelled) {
            setVariants(list.length ? list : [{ lang: 'en', label }])
          }
        } catch {
          if (!cancelled) setVariants([{ lang: 'en', label }])
        }
      })()
    }

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 3000 })
      idleCancel = () => window.cancelIdleCallback(id)
    } else {
      const t = window.setTimeout(run, 1200)
      idleCancel = () => window.clearTimeout(t)
    }

    return () => {
      cancelled = true
      idleCancel?.()
    }
  }, [uri, store.config.endpoint, dossier?.label, loading])

  useEffect(() => {
    if (!variants.length) return
    const codes = variants.map((v) => v.lang)
    if (!codes.includes(contentLanguage)) {
      const pick = pickLanguageVariant(variants, contentLanguage)?.lang ?? codes[0]
      if (pick !== contentLanguage) onContentLanguageChange(pick)
    }
  }, [variants, contentLanguage, onContentLanguageChange])

  const displayLabel = useMemo(() => {
    const v = pickLanguageVariant(variants, contentLanguage, dossier?.label)
    return v?.label ?? dossier?.label ?? store.config.seedLabel
  }, [variants, contentLanguage, dossier?.label, store.config.seedLabel])

  if (!uri) {
    return (
      <div className="overview-view overview-empty">
        <div className="overview-empty-inner">
          <h2>Discover anyone, anything</h2>
          <p className="muted">Search a name to open a rich editorial profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="overview-view overview-reader-page corpus-topic-page">
      {loading && !dossier && (
        <div className="corpus-topic-skeleton" aria-busy="true">
          <div className="corpus-skeleton-hero" />
          <div className="corpus-skeleton-line wide" />
          <div className="corpus-skeleton-line" />
          <div className="corpus-skeleton-grid">
            <div />
            <div />
            <div />
            <div />
          </div>
        </div>
      )}
      {err && <p className="overview-err">{err}</p>}

      {dossier && (
        <DossierView
          dossier={dossier}
          displayLabel={displayLabel}
          onOpenGraph={onOpenGraph}
          onLens={onLens}
          enriching={enriching}
          overviewSection={section}
          onOverviewSection={goToSection}
          onDossierPatch={patchDossier}
          contentLanguage={contentLanguage}
          languageOptions={
            variants.length ? variants : [{ lang: contentLanguage, label: displayLabel }]
          }
          onLanguageChange={onContentLanguageChange}
          languageDisabled={variants.length === 0}
        />
      )}
    </div>
  )
}
