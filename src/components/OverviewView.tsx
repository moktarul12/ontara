import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useEntityDossier } from '../hooks/useEntityDossier'
import {
  fetchEntityLanguageVariants,
  languageDisplayName,
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
  const { dossier, loading, enriching, err } = useEntityDossier(uri, store.config.source, contentLanguage)
  const { section, goToSection } = useOverviewSection(uri, store.config.source)

  const [variants, setVariants] = useState<EntityLanguageVariant[]>([])

  useEffect(() => {
    if (!uri) {
      setVariants([])
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await fetchEntityLanguageVariants(store.config.endpoint, uri)
        if (!cancelled) {
          setVariants(list.length ? list : [{ lang: 'en', label: dossier?.label ?? 'Entity' }])
        }
      } catch {
        if (!cancelled) setVariants([{ lang: 'en', label: dossier?.label ?? 'Entity' }])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [uri, store.config.endpoint, dossier?.label])

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
    <div className="overview-view overview-reader-page">
      <div className="or-topbar">
        <select
          className="or-lang"
          value={contentLanguage}
          disabled={variants.length === 0}
          onChange={(e) => onContentLanguageChange(e.target.value)}
          aria-label="Content language"
        >
          {(variants.length ? variants : [{ lang: contentLanguage, label: displayLabel }]).map((v) => (
            <option key={v.lang} value={v.lang}>
              {languageDisplayName(v.lang)}
            </option>
          ))}
        </select>
        {enriching && <span className="or-topbar-status">AI enriching…</span>}
      </div>

      {loading && !dossier && (
        <div className="or-loading">
          <div className="or-loading-hero" aria-hidden />
          <p>Loading story…</p>
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
        />
      )}
    </div>
  )
}
