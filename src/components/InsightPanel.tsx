import { useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { kindOf } from '../utils/nodeKind'
import { sourceDisplayName } from '../types/ontology'
import { entityUrisMatch } from '../utils/entityUrl'
import { suggestExpands } from '../utils/suggestExpands'
import { CompareFlyer } from './CompareFlyer'
import type { ComparePin } from './CompareView'
import { FacetBar } from './FacetBar'
import type { EntityTab } from './EntityHeader'

type InsightTab = 'about' | 'facts' | 'connections'

interface Props {
  store: OntologyStore
  entityTab?: EntityTab
  comparePins?: ComparePin[]
  onPinToCompare?: (uri: string, label: string) => void
  onRemoveFromCompare?: (uri: string) => void
  onClearCompare?: () => void
  onSelectNode: (id: string) => void
  onExpandFamily?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
  onStartPathMode?: () => void
  onClearPathMode?: () => void
  onAddToCompare?: (uri: string, label: string) => void
  onSaveMap?: () => void
  onCopyShareLink?: () => void
  compareUris?: string[]
  compareCount?: number
  compareMax?: number
  onFacetExpanded?: () => void
}

export function InsightPanel({
  store,
  entityTab = 'graph',
  comparePins = [],
  onPinToCompare,
  onRemoveFromCompare,
  onClearCompare,
  onSelectNode,
  onExpandFamily,
  collapsed = false,
  onToggleCollapse,
  onStartPathMode,
  onClearPathMode,
  onAddToCompare,
  onSaveMap,
  onCopyShareLink,
  compareUris = [],
  compareCount = 0,
  compareMax = 3,
  onFacetExpanded,
}: Props) {
  const [tab, setTab] = useState<InsightTab>('about')
  const node =
    store.selectedNode ||
    store.graph.nodes.find((n) => n.id === store.pathRootId) ||
    store.graph.nodes.find((n) => (n.__hopDepth ?? 0) === 0)

  const suggestions = useMemo(
    () =>
      suggestExpands(
        store.entityKind,
        store.expandedFacets,
        store.relationTypes,
        store.graph,
      ),
    [store.entityKind, store.expandedFacets, store.relationTypes, store.graph],
  )

  const connectionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of store.graph.nodes) {
      if (n.type === 'relation' || n.type === 'literal') continue
      if (n.id === node?.id) continue
      const k = kindOf(n)
      counts[k] = (counts[k] ?? 0) + 1
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
  }, [store.graph.nodes, node?.id])

  const hubs = useMemo(
    () =>
      store.graph.nodes
        .filter((n) => n.type === 'relation')
        .slice(0, 8)
        .map((h) => {
          const kids = store.graph.links.filter((l) => {
            const s = typeof l.source === 'string' ? l.source : l.source.id
            return s === h.id
          }).length
          return { ...h, kids }
        }),
    [store.graph],
  )

  const sources = [
    { id: 'wikidata', label: 'Wikidata', href: node?.uri },
    ...(store.config.source !== 'wikidata'
      ? [{ id: store.config.source, label: sourceDisplayName(store.config.source), href: undefined as string | undefined }]
      : []),
  ]

  if (!node) {
    return (
      <aside
        className={`insight-panel empty ${collapsed ? 'is-collapsed' : ''}`}
        aria-label="Insights"
      >
        <div className="bar-chrome insight-chrome">
          {!collapsed && <span className="bar-chrome-title">Insights</span>}
          <button
            type="button"
            className="bar-toggle"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand insights' : 'Collapse insights'}
            aria-expanded={!collapsed}
          >
            <span className={`chevron ${collapsed ? 'chevron-left' : 'chevron-right'}`} aria-hidden />
          </button>
        </div>
        {!collapsed && (
          <p className="insight-empty">Search an entity to see overview, facts, and sources.</p>
        )}
      </aside>
    )
  }

  const desc =
    store.dataProperties.find((p) =>
      /description|abstract|summary/i.test(p.predicateLabel || p.predicate),
    )?.value ||
    (node.classes?.length
      ? `${node.label} is typed as ${node.classes.slice(0, 4).join(', ')}.`
      : `${node.label} is the focus of this knowledge graph. Expand hops or lenses to grow the map.`)

  const inCompare = compareUris.some((u) => entityUrisMatch(u, node.id))
  const compareFull = compareCount >= compareMax && !inCompare

  const showExploreFlyer =
    entityTab !== 'compare' &&
    store.pathRootId &&
    store.config.startMode !== 'classmap' &&
    (store.entityKind === 'person' || store.entityKind === 'org' || store.entityKind === 'work')

  const isCompareMode = entityTab === 'compare' && onPinToCompare && onRemoveFromCompare && onClearCompare

  return (
    <aside
      className={`insight-panel ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Entity insights"
    >
      <div className="bar-chrome insight-chrome">
        {!collapsed && (
          <span className="bar-chrome-title">{isCompareMode ? 'Compare builder' : 'Insights'}</span>
        )}
        <button
          type="button"
          className="bar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand insights' : 'Collapse insights'}
          aria-expanded={!collapsed}
        >
          <span className={`chevron ${collapsed ? 'chevron-left' : 'chevron-right'}`} aria-hidden />
        </button>
      </div>

      {collapsed ? (
        <button
          type="button"
          className="rail-collapsed-hit"
          onClick={onToggleCollapse}
          title="Expand insights"
        >
          ⓘ
        </button>
      ) : (
        <>
          {store.pathMode === 'pickTarget' && (
            <div className="path-mode-banner" role="status">
              <span>Pick a target entity to find a connection.</span>
              <button type="button" className="eh-btn ghost compact" onClick={onClearPathMode}>
                Cancel
              </button>
            </div>
          )}

          {isCompareMode ? (
            <CompareFlyer
              store={store}
              comparePins={comparePins}
              onAdd={onPinToCompare}
              onRemove={onRemoveFromCompare}
              onClear={onClearCompare}
            />
          ) : (
            <>
          {showExploreFlyer && (
            <FacetBar
              store={store}
              variant="flyer"
              onFamilyLayout={onExpandFamily}
              onExpanded={onFacetExpanded}
            />
          )}

          {suggestions.length > 0 && !showExploreFlyer && (
            <section className="insight-block">
              <h3 className="insight-h">Suggested</h3>
              <div className="phase-chip-row">
                {suggestions.map((s) => (
                  <button
                    key={s.type === 'facet' ? s.id : `${s.relation.predicate}-${s.relation.direction}`}
                    type="button"
                    className="phase-chip"
                    disabled={store.loading}
                    title={s.type === 'facet' ? s.hint : s.relation.predicateLabel}
                    onClick={() => {
                      if (s.type === 'facet') {
                        void store.expandFacet(s.id).then(() => onFacetExpanded?.())
                      } else void store.expandRelation(s.relation)
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="insight-tabs" role="tablist">
            {(
              [
                ['about', 'About'],
                ['facts', 'Key Facts'],
                ['connections', 'Connections'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                className={`insight-tab ${tab === id ? 'on' : ''}`}
                aria-selected={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'about' && (
            <section className="insight-block">
              <h3 className="insight-h">{node.label}</h3>
              <p className="insight-body">{desc}</p>
              <div className="insight-actions">
                {onStartPathMode && (
                  <button type="button" className="insight-cta ghost" onClick={onStartPathMode}>
                    Find connection
                  </button>
                )}
                {onAddToCompare && node.type === 'resource' && (
                  <button
                    type="button"
                    className={`insight-cta ghost ${inCompare ? 'on' : ''}`}
                    disabled={compareFull}
                    title={
                      compareFull
                        ? `Compare full (${compareMax}) — remove one in Compare tab first`
                        : undefined
                    }
                    onClick={() => onAddToCompare(node.id, node.label)}
                  >
                    {inCompare
                      ? `In compare (${compareCount}/${compareMax})`
                      : compareCount > 0
                        ? `Add to compare (${compareCount}/${compareMax})`
                        : 'Add to compare'}
                  </button>
                )}
                {onSaveMap && (
                  <button type="button" className="insight-cta ghost" onClick={onSaveMap}>
                    Save map
                  </button>
                )}
                {onCopyShareLink && (
                  <button type="button" className="insight-cta ghost" onClick={onCopyShareLink}>
                    Copy share link
                  </button>
                )}
              </div>
              {node.type === 'resource' &&
                (store.entityKind === 'person' || kindOf(node) === 'person') &&
                onExpandFamily && (
                  <button type="button" className="insight-cta" onClick={onExpandFamily}>
                    Expand family tree
                  </button>
                )}
            </section>
          )}

          {tab === 'facts' && (
            <section className="insight-block">
              <h3 className="insight-h">Key facts</h3>
              {store.dataProperties.length === 0 ? (
                <p className="insight-body muted">No literal facts loaded yet.</p>
              ) : (
                <ul className="insight-facts">
                  {store.dataProperties.slice(0, 12).map((p) => (
                    <li key={`${p.predicate}|${p.value}`}>
                      <span>{p.predicateLabel || p.predicate.split('/').pop()}</span>
                      <strong>{p.value}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {tab === 'connections' && (
            <section className="insight-block">
              <h3 className="insight-h">Top connections</h3>
              <div className="insight-conn-grid">
                {connectionCounts.map(([k, n]) => (
                  <div key={k} className={`insight-conn kind-${k}`}>
                    <em>{n}</em>
                    <span>{k}</span>
                  </div>
                ))}
              </div>
              <h4 className="insight-h sub">Link types on map</h4>
              <ul className="insight-hubs">
                {hubs.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => onSelectNode(h.id)}>
                      <strong>{h.label}</strong>
                      <span>{h.kids} linked</span>
                    </button>
                  </li>
                ))}
                {!hubs.length && <li className="muted">No relation hubs yet</li>}
              </ul>
            </section>
          )}

          <section className="insight-block sources-block">
            <h3 className="insight-h">Sources</h3>
            <ul className="insight-sources">
              {sources.map((s) => (
                <li key={s.id + s.label}>
                  {s.href ? (
                    <a href={s.href} target="_blank" rel="noreferrer">
                      {s.label} ↗
                    </a>
                  ) : (
                    <span>{s.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {store.lastExpandMessage && (
            <p className="insight-toast" role="status">
              {store.lastExpandMessage}
            </p>
          )}
            </>
          )}
        </>
      )}
    </aside>
  )
}
