import { useEffect, useState } from 'react'
import { buildEntityArticle } from '../services/articleBuilder'
import { fetchEntityProfile } from '../services/entityProfile'
import type { EntityArticle } from '../types/entityArticle'
import type { SparqlSourceId } from '../types/ontology'

export function useEntityArticle(
  uri: string | undefined,
  primarySource: SparqlSourceId,
  lang: string,
) {
  const [article, setArticle] = useState<EntityArticle | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!uri) {
      setArticle(null)
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const profile = await fetchEntityProfile(uri, primarySource, lang)
        const built = await buildEntityArticle(profile, lang)
        if (!cancelled) setArticle(built)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load article')
          setArticle(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [uri, primarySource, lang])

  return { article, loading, err }
}
