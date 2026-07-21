import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { searchInContext } from '../services/sparql'
import {
  searchExamplesForSource,
  searchScopesForSource,
  type ConnectedNode,
  type SearchTypeScopeId,
} from '../types/ontology'

interface Props {
  store: OntologyStore
}

export function GraphSearch({ store }: Props) {
  const { config, openKnowledgeGraph, loading, graph, selectedNode } = store
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ConnectedNode[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [focused, setFocused] = useState(false)
  const [typeScope, setTypeScope] = useState<SearchTypeScopeId>('all')
  const [withinSelected, setWithinSelected] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const empty = graph.nodes.length === 0

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

  useEffect(() => {
    setTypeScope('all')
    setQuery('')
    setResults([])
    setShowDropdown(false)
  }, [config.source])

  useEffect(() => {
    if (selectedNode && !empty) setWithinSelected(true)
  }, [selectedNode?.id, empty])

  // Close suggestions on outside click / Escape
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setShowDropdown(false)
        setFocused(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  useEffect(() => {
    if (!focused) return
    const handle = window.setTimeout(() => {
      void runSearch(query, true)
    }, 280)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, config.endpoint, typeScope, withinSelected, selectedNode?.id, focused])

  const closeSuggestions = () => {
    setShowDropdown(false)
    setResults([])
    setFocused(false)
  }

  const runSearch = async (term: string, asSuggestions: boolean) => {
    const q = term.trim()
    const relatedToUri =
      withinSelected && selectedNode ? selectedNode.uri : undefined

    if (!q && !relatedToUri && !classUri) {
      setResults([])
      setShowDropdown(false)
      return
    }

    setBusy(true)
    setErr(null)
    try {
      const hits = await searchInContext(config.endpoint, {
        term: q,
        classUri,
        relatedToUri,
      })
      setResults(hits)
      if (asSuggestions && focused) setShowDropdown(true)
      else if (!asSuggestions) setShowDropdown(true)
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Search failed')
      setResults([])
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    void runSearch(query, true)
  }

  const openHit = (hit: ConnectedNode) => {
    closeSuggestions()
    setQuery(hit.label)
    void openKnowledgeGraph(hit.uri)
  }

  return (
    <div className={`graph-search ${empty ? 'hero' : 'compact'}`} ref={wrapRef}>
      {empty && (
        <div className="search-hero-copy">
          <p className="eyebrow">
            {config.source === 'wikidata' ? 'Wikidata' : 'DBpedia'} knowledge graph
          </p>
          <h2>Search any person, place, or concept</h2>
          <p>
            Toggle <strong>Wikidata</strong> / <strong>DBpedia</strong> in the header. Select a
            class, then enter a value.
          </p>
        </div>
      )}

      <form className="graph-search-form cascade" onSubmit={handleSubmit}>
        <label className="cascade-field class-field">
          <span>Class</span>
          <select
            value={typeScope}
            onChange={(e) => {
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

        <label className="cascade-field value-field">
          <span>Value</span>
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setFocused(true)
            }}
            onFocus={() => setFocused(true)}
            placeholder={
              typeScope === 'all'
                ? `Search ${config.source === 'wikidata' ? 'Wikidata' : 'DBpedia'}…`
                : `Enter ${scopes.find((s) => s.id === typeScope)?.label ?? ''} value…`
            }
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <button
          type="submit"
          className="primary"
          disabled={busy || loading || (!query.trim() && !withinSelected && !classUri)}
        >
          {busy || loading ? '…' : 'Search'}
        </button>
      </form>

      {!empty && selectedNode && (
        <label className={`within-toggle ${withinSelected ? 'on' : ''}`}>
          <input
            type="checkbox"
            checked={withinSelected}
            onChange={(e) => setWithinSelected(e.target.checked)}
          />
          <span>
            Within selected: <strong>{selectedNode.label}</strong>
          </span>
        </label>
      )}

      {empty && (
        <div className="search-examples">
          {examples.map((ex) => (
            <button
              key={ex.uri}
              type="button"
              className="chip"
              onClick={() => {
                closeSuggestions()
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

      {showDropdown && focused && results.length > 0 && (
        <ul className="graph-search-results">
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
        focused &&
        !busy &&
        results.length === 0 &&
        !err &&
        (query.trim() || withinSelected) && (
          <p className="empty-note search-empty">No matches for this class / value.</p>
        )}
    </div>
  )
}
