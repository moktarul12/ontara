import { useCallback, useEffect, useState } from 'react'
import type { SparqlSourceId } from '../types/ontology'
import {
  parseOverviewSectionSlug,
  type OverviewSectionId,
} from '../services/overviewSections'
import { hashForEntity, overviewSectionFromHash } from '../utils/entityUrl'

function readSectionFromHash(): OverviewSectionId {
  const slug = overviewSectionFromHash(window.location.hash)
  const parsed = slug ? parseOverviewSectionSlug(slug) : null
  return parsed ?? 'summary'
}

export function useOverviewSection(uri: string | undefined, source: SparqlSourceId) {
  const [section, setSection] = useState<OverviewSectionId>(readSectionFromHash)

  useEffect(() => {
    const slug = overviewSectionFromHash(window.location.hash)
    const parsed = slug ? parseOverviewSectionSlug(slug) : null
    setSection(parsed ?? 'summary')
  }, [uri])

  useEffect(() => {
    const onHash = () => {
      const slug = overviewSectionFromHash(window.location.hash)
      const parsed = slug ? parseOverviewSectionSlug(slug) : null
      setSection(parsed ?? 'summary')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const goToSection = useCallback(
    (next: OverviewSectionId) => {
      setSection(next)
      if (!uri) return
      const hash = hashForEntity(uri, source, next === 'summary' ? undefined : next)
      if (window.location.hash !== hash) {
        window.history.replaceState(null, '', hash)
      }
      window.scrollTo({ top: 0, behavior: 'auto' })
    },
    [uri, source],
  )

  return { section, goToSection }
}
