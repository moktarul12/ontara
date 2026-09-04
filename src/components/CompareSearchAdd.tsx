import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useCompareCategory } from '../hooks/useCompareCategory'
import { enrichSearchHits } from '../services/searchEnrich'
import { searchInContext } from '../services/sparql'
import {
  hitFitsCompareCategory,
  type CompareCategory,
} from '../services/compareCategory'
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

type PendingMismatch = { uri: string; label: string; hitKind: string }

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
  const [pendingMismatch, setPendingMismatch] = useState<PendingMismatch | null>(null)

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

  const commitAdd = (uri: string, label: string) => {
    if (pinnedUris.has(entityKey(uri))) return
    onAdd(uri, label)
    setQuery('')
    setSearchHits([])
    setPendingMismatch(null)
  }

  /** Soft category lock: peers always ok; search mismatches need confirm. */
  const pick = (uri: string, label: string, fromPeerChip = false) => {
    if (pinnedUris.has(entityKey(uri))) return
    if (!hasAnchor || !category || fromPeerChip) {
      commitAdd(uri, label)
      return
    }
    const detail = searchHits.find((h) => h.uri === uri)
    const fit = hitFitsCompareCategory(
      detail ?? { kind: category.kind, categoryLabel: category.label },
      category,
    )
    if (fit === 'mismatch') {
      setPendingMismatch({
        uri,
        label,
        hitKind: detail?.categoryLabel || detail?.kind || 'different type',
      })
      return
    }
    commitAdd(uri, label)
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
      {hasAnchor && category && (
        <div className="compare-category-lock" role="status">
          <span className="compare-category-lock-kicker">Same category</span>
          <strong className="compare-category-lock-label">{category.label}</strong>
          <span className="compare-category-lock-hint muted">
            Peers & search stay in this category · clear pins to switch
          </span>
        </div>
      )}

      <label className="compare-search-label">
        <span className="sr-only">Search to add entity</span>
        <input
          type="search"
          className="compare-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPendingMismatch(null)
          }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {(busy || peersLoading) && (
        <p className="compare-search-meta muted">{busy ? 'Searching…' : 'Loading peers…'}</p>
      )}
      {err && <p className="compare-search-err">{err}</p>}

      {pendingMismatch && category && (
        <div className="compare-category-warn" role="alert">
          <p>
            <strong>{pendingMismatch.label}</strong> looks like{' '}
            <em>{pendingMismatch.hitKind}</em>, not <em>{category.label}</em>.
          </p>
          <div className="compare-category-warn-actions">
            <button
              type="button"
              className="eh-btn ghost compact"
              onClick={() => setPendingMismatch(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="eh-btn compact"
              onClick={() => commitAdd(pendingMismatch.uri, pendingMismatch.label)}
            >
              Add anyway
            </button>
          </div>
        </div>
      )}

      {hasAnchor && chips.length > 0 && (
        <div className="compare-suggest-chips">
          <span className="compare-suggest-label muted">
            {category ? `Peers · ${category.label}` : 'Same category'}
          </span>
          {chips.map((s) => (
            <button
              key={s.uri}
              type="button"
              className="compare-suggest-chip"
              title={s.reason}
              onClick={() => pick(s.uri, s.label, true)}
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
            const fit = hitFitsCompareCategory(detail, category)
            return (
              <li key={s.uri}>
                <SearchHitCard
                  hit={detail}
                  compact
                  actionLabel={fit === 'mismatch' ? 'Different category' : 'Add to compare'}
                  onClick={() => pick(s.uri, s.label, false)}
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
