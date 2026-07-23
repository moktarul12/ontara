import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { searchByDataProperty, searchInContext, isOntologyClassUri } from '../services/sparql'
import {
  DATA_PROPERTY_SEARCH_DEFS,
  DATA_PROP_SEARCH_EXAMPLES,
  dataPropertyUriForSource,
  searchExamplesForSource,
  searchScopesForSource,
  type ConnectedNode,
  type SearchMode,
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
  const [mode, setMode] = useState<SearchMode>('entity')
  const [query, setQuery] = useState('')
  const [propertyId, setPropertyId] = useState(DATA_PROPERTY_SEARCH_DEFS[4]?.id ?? 'filmingLocation')
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

  const source = config.source ?? 'wikidata'
  const scopes = useMemo(() => searchScopesForSource(source), [source])
  const examples = useMemo(() => searchExamplesForSource(source), [source])
  const propertyDef = useMemo(
    () => DATA_PROPERTY_SEARCH_DEFS.find((p) => p.id === propertyId) ?? DATA_PROPERTY_SEARCH_DEFS[0],
    [propertyId],
  )

  const classUri = useMemo(
    () => scopes.find((s) => s.id === typeScope)?.classUri,
    [typeScope, scopes],
  )

  const canSearchWithin =
    mode === 'entity' &&
    !!selectedNode &&
    graph.nodes.length > 0 &&
    !isOntologyClassUri(selectedNode.uri)

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
    setMode('entity')
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
    if (suggestionsLocked || mode !== 'entity') return
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
  }, [query, config.endpoint, typeScope, withinSelected, selectedNode?.id, suggestionsLocked, mode])

  const runSearch = async (term: string, asSuggest: boolean) => {
    const q = term.trim()

    if (mode === 'dataprop') {
      if (!q || !propertyDef) {
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
        const hits = await searchByDataProperty(config.endpoint, {
          propertyUri: dataPropertyUriForSource(propertyDef, source),
          value: q,
          valueKind: propertyDef.valueKind,
          classUri,
          limit: 25,
        })
        if (gen !== abortRef.current) return
        setResults(hits)
        setShowDropdown(true)
      } catch (error) {
        if (gen !== abortRef.current) return
        setErr(error instanceof Error ? error.message : 'Search failed')
        setResults([])
        setShowDropdown(true)
      } finally {
        if (gen === abortRef.current) setBusy(false)
      }
      return
    }

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
    setMode('entity')
    void openKnowledgeGraph(hit.uri)
  }

  const showEntityChips = showExamples && mode === 'entity' && !query.trim() && !suggestVisible
  const showPropChips = showExamples && mode === 'dataprop' && !suggestVisible

  return (
    <div className={`search-dock ${suggestVisible ? 'suggesting' : ''}`} ref={wrapRef}>
      <div className="search-dock-row">
        <div className="search-mode-toggle" role="group" aria-label="Search mode">
          <button
            type="button"
            className={mode === 'entity' ? 'on' : ''}
            onClick={() => {
              setMode('entity')
              setShowDropdown(false)
              setResults([])
              setSuggestionsLocked(false)
            }}
          >
            Entity
          </button>
          <button
            type="button"
            className={mode === 'dataprop' ? 'on' : ''}
            onClick={() => {
              setMode('dataprop')
              setShowDropdown(false)
              setResults([])
              setSuggestionsLocked(false)
              setWithinSelected(false)
            }}
          >
            Data property
          </button>
        </div>

        <form className={`search-form ${mode === 'dataprop' ? 'dataprop' : ''}`} onSubmit={handleSubmit}>
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

          {mode === 'dataprop' && (
            <label className="sf-field sf-prop">
              <span>Property</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value)
                  setShowDropdown(false)
                  setSuggestionsLocked(false)
                }}
              >
                {DATA_PROPERTY_SEARCH_DEFS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          )}

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
              placeholder={
                mode === 'dataprop'
                  ? propertyDef?.valueKind === 'entity'
                    ? 'e.g. London, India, Action…'
                    : 'e.g. 1879, 2008-07-18…'
                  : `Search ${source === 'wikidata' ? 'Wikidata' : 'DBpedia'}…`
              }
              autoComplete="off"
              spellCheck={false}
            />
          </label>

          <button
            type="submit"
            className="sf-go"
            disabled={
              busy ||
              loading ||
              (mode === 'dataprop'
                ? !query.trim()
                : !query.trim() && !withinSelected && !classUri)
            }
          >
            {busy || loading ? '…' : 'Search'}
          </button>
        </form>

        {canSearchWithin && (
          <label className={`within-line inline ${withinSelected ? 'on' : ''}`}>
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

        <HopQuick store={store} />
      </div>
      {showEntityChips && (
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

      {showPropChips && (
        <div className="search-examples">
          {DATA_PROP_SEARCH_EXAMPLES.map((ex) => (
            <button
              key={`${ex.propertyId}-${ex.value}`}
              type="button"
              className="chip"
              onClick={() => {
                setPropertyId(ex.propertyId)
                setTypeScope(ex.classId)
                setQuery(ex.value)
                setSuggestionsLocked(false)
                void runSearch(ex.value, false)
              }}
            >
              {DATA_PROPERTY_SEARCH_DEFS.find((p) => p.id === ex.propertyId)?.label ?? ex.propertyId}
              : {ex.value}
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
