import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useCompareCategory } from '../hooks/useCompareCategory'
import { enrichSearchHits } from '../services/searchEnrich'
import { searchInContext } from '../services/sparql'
import type { CompareCategory } from '../services/compareCategory'
import type { SearchHitDetail } from '../types/ontology'
import {
  buildCompareSuggestions,
  compareSearchClassUri,
  compareSuggestionChips,
  idleCompareChips,
} from '../utils/compareSuggestions'
import { entityKey } from '../utils/entityUrl'
import type { ComparePin } from './CompareView'
import { SearchHitCard } from './SearchHitCard'

export const MAX_COMPARE = 3

interface Props {
  store: OntologyStore
  comparePins: ComparePin[]
  onAdd: (uri: string, label: string) => void
  category?: CompareCategory | null
  categoryPeers?: { uri: string; label: string; reason: string }[]
  peersLoading?: boolean
  compact?: boolean
}

export function CompareSearchAdd({
  store,
  comparePins,
  onAdd,
  category = null,
  categoryPeers = [],
  peersLoading = false,
  compact,
}: Props) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [searchHits, setSearchHits] = useState<SearchHitDetail[]>([])

  const pinnedUris = useMemo(
    () => new Set(comparePins.map((p) => entityKey(p.uri))),
    [comparePins],
  )
  const pinnedUriSet = useMemo(() => new Set(comparePins.map((p) => p.uri)), [comparePins])
  const pinnedLabels = useMemo(() => comparePins.map((p) => p.label), [comparePins])
  const slotsLeft = MAX_COMPARE - comparePins.length
  const hasAnchor = comparePins.length > 0

  const wdPeers = useMemo(
    () => categoryPeers.map((p) => ({ uri: p.uri, label: p.label, reason: p.reason })),
    [categoryPeers],
  )

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setSearchHits([])
      setBusy(false)
      setErr(null)
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        setBusy(true)
        setErr(null)
        try {
          const classUri = hasAnchor
            ? compareSearchClassUri(q, pinnedLabels, category)
            : undefined
          const hits = await searchInContext(store.config.endpoint, {
            term: q,
            classUri,
            limit: 10,
          })
          setSearchHits(await enrichSearchHits(store.config.endpoint, hits))
        } catch (e) {
          setErr(e instanceof Error ? e.message : 'Search failed')
          setSearchHits([])
        } finally {
          setBusy(false)
        }
      })()
    }, 220)
    return () => window.clearTimeout(t)
  }, [query, store.config.endpoint, pinnedLabels, hasAnchor, category])

  const suggestions = useMemo(
    () =>
      buildCompareSuggestions({
        query: query.trim(),
        pinnedUris: pinnedUriSet,
        pinnedLabels,
        graphNodes: store.graph.nodes,
        graphLinks: store.graph.links,
        searchHits,
        categoryPeers: wdPeers,
        category,
      }),
    [
      query,
      comparePins,
      pinnedUriSet,
      pinnedLabels,
      store.graph.nodes,
      store.graph.links,
      searchHits,
      wdPeers,
      category,
    ],
  )

  const chips = useMemo(() => {
    if (!hasAnchor) return []
    if (query.trim().length >= 2) {
      return compareSuggestionChips(suggestions, searchHits)
    }
    return idleCompareChips({
      pinnedUris: pinnedUriSet,
      pinnedLabels,
      categoryPeers: wdPeers,
    })
  }, [hasAnchor, query, suggestions, searchHits, pinnedUriSet, pinnedLabels, wdPeers])

  const pick = (uri: string, label: string) => {
    if (pinnedUris.has(entityKey(uri))) return
    onAdd(uri, label)
    setQuery('')
    setSearchHits([])
  }

  const placeholder =
    comparePins.length === 0
      ? 'Search first entity…'
      : category
        ? `Add more ${category.label.toLowerCase()} (${slotsLeft} left)…`
        : `Add similar entity (${slotsLeft} left)…`

  const showResults = query.trim().length >= 2 && suggestions.length > 0
  const showEmpty = query.trim().length >= 2 && !busy && suggestions.length === 0

  return (
    <div className={`compare-search ${compact ? 'is-compact' : ''}`}>
      <label className="compare-search-label">
        <span className="sr-only">Search to add entity</span>
        <input
          type="search"
          className="compare-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {(busy || peersLoading) && (
        <p className="compare-search-meta muted">{busy ? 'Searching…' : 'Loading suggestions…'}</p>
      )}
      {err && <p className="compare-search-err">{err}</p>}

      {hasAnchor && chips.length > 0 && (
        <div className="compare-suggest-chips">
          <span className="compare-suggest-label muted">
            {category ? category.label : 'Same category'}
          </span>
          {chips.map((s) => (
            <button
              key={s.uri}
              type="button"
              className="compare-suggest-chip"
              title={s.reason}
              onClick={() => pick(s.uri, s.label)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {showResults && (
        <ul className="search-rail-results rich compare-search-results">
          {suggestions.map((s) => {
            const detail =
              searchHits.find((h) => h.uri === s.uri) ??
              ({
                uri: s.uri,
                label: s.label,
                kind: category?.kind ?? 'entity',
                categoryLabel: s.reason ?? category?.label ?? 'Entity',
                description: s.reason,
              } satisfies SearchHitDetail)
            return (
              <li key={s.uri}>
                <SearchHitCard
                  hit={detail}
                  compact
                  actionLabel="Add to compare"
                  onClick={() => pick(s.uri, s.label)}
                />
              </li>
            )
          })}
        </ul>
      )}
      {showEmpty && <p className="compare-search-meta muted">No matches — try another name.</p>}
    </div>
  )
}

/** Self-contained compare search with Wikidata category loading (standalone use). */
export function CompareSearchAddWithCategory(
  props: Omit<Props, 'category' | 'categoryPeers' | 'peersLoading'>,
) {
  const anchorUri = props.comparePins[0]?.uri
  const exclude = props.comparePins.map((p) => p.uri)
  const { category, peers, loading } = useCompareCategory(
    props.store.config.endpoint,
    anchorUri,
    exclude,
  )
  return (
    <CompareSearchAdd
      {...props}
      category={category}
      categoryPeers={peers}
      peersLoading={loading}
    />
  )
}
