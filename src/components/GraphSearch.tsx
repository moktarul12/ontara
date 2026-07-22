import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { searchInContext, isOntologyClassUri } from '../services/sparql'
import {
  searchExamplesForSource,
  searchScopesForSource,
  type ConnectedNode,
  type SearchTypeScopeId,
} from '../types/ontology'
import { HopQuick } from './HopQuick'

interface Props {
  store: OntologyStore
  showExamples?: boolean
  onSuggestOpenChange?: (open: boolean) => void
}

export function GraphSearch({
  store,
  showExamples = false,
  onSuggestOpenChange,
}: Props) {
  const { config, openKnowledgeGraph, loading, graph, selectedNode } = store
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConnectedNode[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [typeScope, setTypeScope] = useState<SearchTypeScopeId>('all')
  const [withinSelected, setWithinSelected] = useState(false)
  const [searched, setSearched] = useState(false)
  const [suggestionsLocked, setSuggestionsLocked] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<number>(0)

  const scopes = useMemo(
    () => searchScopesForSource(config.source ?? 'wikidata'),
    [config.source],
  )
  const examples = useMemo(
    () => searchExamplesForSource(config.source ?? 'wikidata'),
    [config.source],
  )

  const classUri = useMemo(
    () => scopes.find((s) => s.id === typeScope)?.classUri,
    [typeScope, scopes],
  )

  const canSearchWithin =
    !!selectedNode && graph.nodes.length > 0 && !isOntologyClassUri(selectedNode.uri)

  const suggestVisible =
    showDropdown && !suggestionsLocked && (results.length > 0 || (searched && !busy))

  useEffect(() => {
    onSuggestOpenChange?.(suggestVisible)
  }, [suggestVisible, onSuggestOpenChange])

  useEffect(() => {
    setTypeScope('all')
    setQuery('')
    setResults([])
    setShowDropdown(false)
    setWithinSelected(false)
    setSearched(false)
    setSuggestionsLocked(false)
  }, [config.source])

  useEffect(() => {
    if (!canSearchWithin) setWithinSelected(false)
  }, [canSearchWithin])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setShowDropdown(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDropdown(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (suggestionsLocked) return
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setShowDropdown(false)
      setSearched(false)
      return
    }
    const handle = window.setTimeout(() => {
      void runSearch(q, true)
    }, 220)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, config.endpoint, typeScope, withinSelected, selectedNode?.id, suggestionsLocked])

  const runSearch = async (term: string, asSuggest: boolean) => {
    const q = term.trim()
    const relatedToUri =
      withinSelected && canSearchWithin && selectedNode ? selectedNode.uri : undefined

    if (!q && !relatedToUri && !classUri) {
      setResults([])
      setShowDropdown(false)
      setSearched(false)
      return
    }

    const gen = ++abortRef.current
    setBusy(true)
    setErr(null)
    setSearched(true)
    try {
      const hits = await searchInContext(config.endpoint, {
        term: q,
        classUri,
        relatedToUri,
      })
      if (gen !== abortRef.current) return
      setResults(hits)
      if (!suggestionsLocked || !asSuggest) setShowDropdown(true)
    } catch (error) {
      if (gen !== abortRef.current) return
      setErr(error instanceof Error ? error.message : 'Search failed')
      setResults([])
      if (!suggestionsLocked || !asSuggest) setShowDropdown(true)
    } finally {
      if (gen === abortRef.current) setBusy(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setSuggestionsLocked(false)
    void runSearch(query, false)
  }

  const openHit = (hit: ConnectedNode) => {
    setSuggestionsLocked(true)
    setShowDropdown(false)
    setResults([])
    setSearched(false)
    setErr(null)
    setQuery(hit.label)
    void openKnowledgeGraph(hit.uri)
  }

  const showChips = showExamples && !query.trim() && !suggestVisible

  return (
    <div className={`search-dock ${suggestVisible ? 'suggesting' : ''}`} ref={wrapRef}>
      <div className="search-dock-row">
        <form className="search-form" onSubmit={handleSubmit}>
          <label className="sf-field sf-class">
            <span>Class</span>
            <select
              value={typeScope}
              onChange={(e) => {
                setSuggestionsLocked(false)
                setTypeScope(e.target.value as SearchTypeScopeId)
                setShowDropdown(false)
              }}
            >
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label className="sf-field sf-value">
            <span>Value</span>
            <input
              value={query}
              onChange={(e) => {
                setSuggestionsLocked(false)
                setQuery(e.target.value)
              }}
              onFocus={() => {
                if (!suggestionsLocked && results.length > 0) setShowDropdown(true)
              }}
              placeholder={`Search ${config.source === 'wikidata' ? 'Wikidata' : 'DBpedia'}…`}
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <button
            type="submit"
            className="sf-go"
            disabled={busy || loading || (!query.trim() && !withinSelected && !classUri)}
          >
            {busy || loading ? '…' : 'Search'}
          </button>
        </form>

        <HopQuick store={store} />
      </div>

      {canSearchWithin && (
        <label className={`within-line ${withinSelected ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={withinSelected}
            onChange={(e) => {
              setSuggestionsLocked(false)
              setWithinSelected(e.target.checked)
            }}
          />
          <span>
            Within <strong>{selectedNode!.label}</strong>
          </span>
        </label>
      )}

      {showChips && (
        <div className="search-examples">
          {examples.map((ex) => (
            <button
              key={ex.uri}
              type="button"
              className="chip"
              onClick={() => {
                setSuggestionsLocked(true)
                setShowDropdown(false)
                setResults([])
                setQuery(ex.label)
                void openKnowledgeGraph(ex.uri)
              }}
            >
              {ex.label}
            </button>
          ))}
        </div>
      )}

      {err && <p className="search-error">{err}</p>}

      {showDropdown && !suggestionsLocked && results.length > 0 && (
        <ul className="search-results">
          {results.map((r) => (
            <li key={r.uri}>
              <button type="button" onClick={() => openHit(r)}>
                <span className="hit-label">{r.label}</span>
                {r.typeLabel ? <span className="hit-type">{r.typeLabel}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}

      {showDropdown &&
        !suggestionsLocked &&
        searched &&
        !busy &&
        results.length === 0 &&
        !err && <p className="search-empty">No matches.</p>}
    </div>
  )
}
