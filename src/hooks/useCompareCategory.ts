import { useEffect, useState } from 'react'
import {
  loadCompareCategoryBundle,
  type CompareCategory,
  type CompareCategoryPeer,
} from '../services/compareCategory'

export function useCompareCategory(
  endpoint: string,
  anchorUri: string | undefined,
  excludeUris: string[] = [],
) {
  const [category, setCategory] = useState<CompareCategory | null>(null)
  const [peers, setPeers] = useState<CompareCategoryPeer[]>([])
  const [loading, setLoading] = useState(false)

  const excludeKey = excludeUris.map((u) => u).join('|')

  useEffect(() => {
    if (!anchorUri) {
      setCategory(null)
      setPeers([])
      setLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const bundle = await loadCompareCategoryBundle(endpoint, anchorUri, excludeUris)
        if (cancelled) return
        setCategory(bundle.category)
        setPeers(bundle.peers)
      } catch {
        if (cancelled) return
        setCategory(null)
        setPeers([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [endpoint, anchorUri, excludeKey])

  return { category, peers, loading }
}
