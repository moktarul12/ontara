import { useEffect, useState } from 'react'
import { enrichSearchHits, inferKindFromQuery } from '../services/searchEnrich'
import { searchInContext } from '../services/sparql'
import type { SearchCategoryFilter, SearchHitDetail } from '../types/ontology'
import { SEARCH_TYPE_SCOPES_WIKIDATA } from '../types/ontology'

export function useEnrichedSearch(
  endpoint: string,
  query: string,
  classUri: string | undefined,
  debounceMs = 220,
) {
  const [hits, setHits] = useState<SearchHitDetail[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [queryKindHint, setQueryKindHint] = useState<SearchHitDetail['kind'] | null>(null)

  useEffect(() => {
    setQueryKindHint(inferKindFromQuery(query.trim()))
  }, [query])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setBusy(false)
      setErr(null)
      return
    }

    const t = window.setTimeout(() => {
      void (async () => {
        setBusy(true)
        setErr(null)
        try {
          const raw = await searchInContext(endpoint, { term: q, classUri, limit: 14 })
          const enriched = await enrichSearchHits(endpoint, raw)
          setHits(enriched)
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Search failed')
          setHits([])
        } finally {
          setBusy(false)
        }
      })()
    }, debounceMs)

    return () => window.clearTimeout(t)
  }, [query, endpoint, classUri, debounceMs])

  return { hits, busy, err, queryKindHint }
}

export function classUriForKind(kind: SearchHitDetail['kind']): string | undefined {
  const id =
    kind === 'person'
      ? 'person'
      : kind === 'work'
        ? 'work'
        : kind === 'org'
          ? 'organisation'
          : kind === 'place'
            ? 'place'
            : null
  if (!id) return undefined
  return SEARCH_TYPE_SCOPES_WIKIDATA.find((s) => s.id === id)?.classUri
}

export function filterKey(filter: SearchCategoryFilter): string {
  if (filter.type === 'all') return 'all'
  if (filter.type === 'kind') return `kind:${filter.kind}`
  return `cat:${filter.label}`
}
