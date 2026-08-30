import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { classUriForKind, filterKey, useEnrichedSearch } from '../hooks/useEnrichedSearch'
import {
  buildSearchCategoryChips,
  filterSearchHits,
  searchResultSummary,
  SEARCH_KIND_LABEL,
} from '../services/searchEnrich'
import {
  searchExamplesForSource,
  sourceDisplayName,
  SPARQL_SOURCES,
  type SearchCategoryFilter,
  type SearchHitDetail,
  type SparqlSourceId,
} from '../types/ontology'
import { GuidedJourneys, type JourneyLaunchOptions } from './GuidedJourneys'
import { SearchHitCard } from './SearchHitCard'
import { kindOf } from '../utils/nodeKind'

interface Props {
  store: OntologyStore
  onChangeSource: (source: SparqlSourceId) => void
  onHome?: () => void
  focusSearch?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  onEntityOpened?: () => void
  onBusyChange?: (busy: boolean) => void
  onLaunchJourney?: (opts: JourneyLaunchOptions) => void
  onPathTarget?: (uri: string) => void
  pathTargetHint?: { label: string; uri: string }
  showJourneys?: boolean
}

export function SearchRail({
  store,
  onChangeSource,
  onHome,
  focusSearch,
  collapsed = false,
  onToggleCollapse,
  onEntityOpened,
  onBusyChange,
  onLaunchJourney,
  onPathTarget,
  pathTargetHint,
  showJourneys = false,
}: Props) {
  const { config, openKnowledgeGraph, loading, graph, dataProperties, selectedNode, entityKind } =
    store
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<SearchCategoryFilter>({ type: 'all' })
  const [scopeKind, setScopeKind] = useState<SearchHitDetail['kind'] | 'all'>('all')

  const classUri = useMemo(() => {
    if (scopeKind !== 'all') return classUriForKind(scopeKind)
    return undefined
  }, [scopeKind])

  const { hits, busy, err, queryKindHint } = useEnrichedSearch(
    config.endpoint,
    query,
    classUri,
  )

  const categoryChips = useMemo(() => buildSearchCategoryChips(hits), [hits])
  const filteredHits = useMemo(
    () => filterSearchHits(hits, categoryFilter),
    [hits, categoryFilter],
  )
  const summary = useMemo(() => searchResultSummary(hits), [hits])

  const examples = useMemo(() => searchExamplesForSource(config.source), [config.source])

  useEffect(() => {
    onBusyChange?.(busy)
    return () => onBusyChange?.(false)
  }, [busy, onBusyChange])

  useEffect(() => {
    setQuery('')
    setCategoryFilter({ type: 'all' })
    setScopeKind('all')
  }, [config.source])

  useEffect(() => {
    setCategoryFilter({ type: 'all' })
  }, [query])

  const focus =
    selectedNode && selectedNode.type !== 'relation' && selectedNode.type !== 'literal'
      ? selectedNode
      : graph.nodes.find((n) => n.id === store.pathRootId) ??
        graph.nodes.find((n) => (n.__hopDepth ?? 0) === 0)

  const openEntity = (uri: string) => {
    if (store.pathMode === 'pickTarget' && onPathTarget) {
      onPathTarget(uri)
      return
    }
    onEntityOpened?.()
    void openKnowledgeGraph(uri)
  }

  const quickStats = useMemo(() => {
    const people = graph.nodes.filter((n) => kindOf(n) === 'person').length
    const orgs = graph.nodes.filter((n) => kindOf(n) === 'org').length
    const works = graph.nodes.filter((n) => kindOf(n) === 'work').length
    const places = graph.nodes.filter((n) => kindOf(n) === 'place').length
    const props = dataProperties.slice(0, 3).map((p) => ({
      label: p.predicateLabel || p.predicate.split('/').pop() || 'Fact',
      value: (p.value || '').slice(0, 28),
    }))
    if (props.length) return props
    return [
      { label: 'People', value: String(people) },
      { label: 'Orgs', value: String(orgs) },
      { label: 'Works', value: String(works) },
      { label: 'Places', value: String(places) },
    ].filter((c) => Number(c.value) > 0)
  }, [graph.nodes, dataProperties])

  const hasQuery = query.trim().length >= 2
  const activeFilterKey = filterKey(categoryFilter)

  return (
    <aside
      className={`search-rail ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Explore and search"
    >
      <div className="bar-chrome rail-chrome">
        <button
          type="button"
          className="search-rail-brand"
          onClick={onHome}
          title="Ontopedian home"
        >
          <span className="search-rail-mark" aria-hidden />
          {!collapsed && <span className="search-rail-brand-name">Ontopedian</span>}
        </button>
        <button
          type="button"
          className="bar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
          aria-expanded={!collapsed}
        >
          <span className={`chevron ${collapsed ? 'chevron-right' : 'chevron-left'}`} aria-hidden />
        </button>
      </div>

      {collapsed ? (
        <button
          type="button"
          className="rail-collapsed-hit"
          onClick={onToggleCollapse}
          title="Expand search"
        >
          ⌕
        </button>
      ) : (
        <div className="search-rail-body">
          {showJourneys && onLaunchJourney && (
            <GuidedJourneys compact onLaunch={onLaunchJourney} />
          )}

          {store.pathMode === 'pickTarget' && (
            <div className="path-mode-banner compact" role="status">
              Pick target entity in search results
              {pathTargetHint && onPathTarget && (
                <button
                  type="button"
                  className="phase-chip"
                  onClick={() => onPathTarget(pathTargetHint.uri)}
                >
                  {pathTargetHint.label}
                </button>
              )}
            </div>
          )}

          <div className="search-rail-sources" role="group" aria-label="Knowledge source">
            {SPARQL_SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rail-source ${config.source === s.id ? 'on' : ''}`}
                disabled={loading}
                onClick={() => onChangeSource(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          <label className="search-rail-box">
            <span className="search-rail-ico" aria-hidden />
            <input
              autoFocus={focusSearch}
              type="search"
              placeholder="Search people, films, companies, places…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <div className="search-scope-row">
            <span className="search-scope-label">Browse</span>
            <div className="search-scope-chips">
              {(['all', 'person', 'work', 'org', 'place'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`search-scope-chip ${scopeKind === k ? 'on' : ''}`}
                  onClick={() => setScopeKind(k)}
                >
                  {k === 'all' ? 'All types' : SEARCH_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>

          {queryKindHint && !hasQuery && (
            <p className="search-rail-meta search-query-hint">
              Tip: queries with &ldquo;{query.trim()}&rdquo; often match{' '}
              <strong>{SEARCH_KIND_LABEL[queryKindHint]}</strong>
            </p>
          )}

          <div className="search-rail-section">
            <div className="search-rail-section-head">
              <h2 className="search-rail-h">{hasQuery ? 'Results' : 'Try these'}</h2>
              {hasQuery && summary && !busy && (
                <p className="search-rail-summary">{summary}</p>
              )}
            </div>

            {busy && <p className="search-rail-meta">Searching &amp; categorizing…</p>}
            {err && <p className="search-rail-err">{err}</p>}

            {hasQuery && categoryChips.length > 1 && (
              <div className="search-category-chips" role="group" aria-label="Filter by category">
                {categoryChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`search-category-chip ${activeFilterKey === filterKey(chip.filter) ? 'on' : ''}`}
                    onClick={() => setCategoryFilter(chip.filter)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            <ul className="search-rail-results rich">
              {hasQuery &&
                filteredHits.map((hit) => (
                  <li key={hit.uri}>
                    <SearchHitCard
                      hit={hit}
                      disabled={loading}
                      onClick={() => openEntity(hit.uri)}
                    />
                  </li>
                ))}

              {!hasQuery &&
                examples.slice(0, 6).map((ex) => (
                  <li key={ex.uri}>
                    <SearchHitCard
                      hit={{
                        uri: ex.uri,
                        label: ex.label,
                        kind: 'entity',
                        categoryLabel: 'Example',
                        description: 'Curated starter entity',
                      }}
                      disabled={loading}
                      onClick={() => openEntity(ex.uri)}
                      compact
                    />
                  </li>
                ))}

              {hasQuery && !busy && filteredHits.length === 0 && (
                <li className="search-rail-empty">
                  No matches
                  {categoryFilter.type !== 'all' ? ' in this category' : ''} — try another term or
                  filter.
                </li>
              )}
            </ul>
          </div>

          {focus && (
            <div className="search-rail-section quick-stats">
              <h2 className="search-rail-h">On your map</h2>
              <p className="search-rail-focus">{focus.label}</p>
              <p className="search-rail-meta">
                {entityKind !== 'other' ? entityKind : kindOf(focus)} · {graph.nodes.length} nodes
                {quickStats.length > 0
                  ? ` · ${quickStats.map((s) => `${s.value} ${s.label.toLowerCase()}`).join(' · ')}`
                  : ''}
              </p>
            </div>
          )}

          <div className="search-rail-foot">
            <span className="search-rail-foot-label">Source</span>
            <span className="search-rail-foot-value">{sourceDisplayName(config.source)}</span>
          </div>
        </div>
      )}
    </aside>
  )
}
