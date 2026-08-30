import { useEffect, useState } from 'react'
import { fetchEntityProfile, type EntityProfile } from '../services/entityProfile'
import type { SparqlSourceId } from '../types/ontology'

export function useEntityProfile(
  uri: string | undefined,
  primarySource: SparqlSourceId,
  lang: string,
) {
  const [profile, setProfile] = useState<EntityProfile | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!uri) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      setErr(null)
      try {
        const p = await fetchEntityProfile(uri, primarySource, lang)
        if (!cancelled) setProfile(p)
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load profile')
          setProfile(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [uri, primarySource, lang])

  return { profile, loading, err }
}
