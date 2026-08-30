import type { OntologyStore } from '../hooks/useOntologyStore'
import { kindOf } from '../utils/nodeKind'

export type EntityTab =
  | 'overview'
  | 'graph'
  | 'family'
  | 'movie'
  | 'business'
  | 'music'
  | 'places'
  | 'timeline'
  | 'table'
  | 'evidence'
  | 'compare'

interface Props {
  store: OntologyStore
  activeTab: EntityTab
  onTab: (tab: EntityTab) => void
  onFamily: () => void
  onMovie: () => void
  onGraph: () => void
  headerCollapsed?: boolean
  onToggleHeader?: () => void
  /** Hide horizontal lens tabs — overview uses vertical category nav */
  hideLensTabs?: boolean
}

export function EntityHeader({
  store,
  activeTab,
  onTab,
  onFamily,
  onMovie,
  onGraph,
  headerCollapsed = false,
  onToggleHeader,
  hideLensTabs = false,
}: Props) {
  const root =
    store.graph.nodes.find((n) => n.id === store.pathRootId) ||
    store.graph.nodes.find((n) => (n.__hopDepth ?? 0) === 0) ||
    store.selectedNode
  const label = root?.label || store.config.seedLabel || 'Entity'
  const kind = root ? kindOf(root) : store.entityKind
  const classes = (root?.classes ?? []).slice(0, 3)
  const portrait = root?.__imageUrl
  const canFamily = store.entityKind === 'person' || kind === 'person'
  const canMovie = store.entityKind === 'work' || kind === 'work'

  const tabs: { id: EntityTab; label: string; run: () => void; hide?: boolean }[] = [
    { id: 'overview', label: 'Overview', run: () => {} },
    { id: 'graph', label: 'Knowledge Graph', run: onGraph },
    { id: 'family', label: 'Family', run: onFamily, hide: !canFamily },
    { id: 'movie', label: 'Movie', run: onMovie, hide: !canMovie },
    { id: 'business', label: 'Business', run: () => onTab('business') },
    { id: 'music', label: 'Music', run: () => onTab('music') },
    { id: 'places', label: 'Places', run: () => onTab('places') },
    { id: 'timeline', label: 'Timeline', run: () => onTab('timeline') },
    { id: 'compare', label: 'Compare', run: () => onTab('compare') },
    { id: 'table', label: 'Table', run: () => onTab('table') },
    { id: 'evidence', label: 'Evidence', run: () => onTab('evidence') },
  ]

  return (
    <header className={`entity-header ${headerCollapsed ? 'is-collapsed' : ''}`}>
      <div className="bar-chrome entity-chrome">
        <span className="bar-chrome-title">{headerCollapsed ? label : 'Entity'}</span>
        <button
          type="button"
          className="bar-toggle"
          onClick={onToggleHeader}
          title={headerCollapsed ? 'Expand header' : 'Collapse header'}
          aria-expanded={!headerCollapsed}
        >
          <span
            className={`chevron ${headerCollapsed ? 'chevron-down' : 'chevron-up'}`}
            aria-hidden
          />
        </button>
      </div>

      {!headerCollapsed && (
        <>
          <div className="entity-header-main">
            <div className="entity-identity">
              <div className={`entity-portrait kind-${kind}`}>
                {portrait ? (
                  <img src={portrait} alt="" />
                ) : (
                  <span aria-hidden>{label.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
              <div className="entity-titles">
                <h1 className="entity-name">{label}</h1>
                <p className="entity-sub">
                  <span className="entity-tag">{kind}</span>
                  {classes.map((c) => (
                    <span key={c} className="entity-tag soft">
                      {c}
                    </span>
                  ))}
                  <span className="entity-tag soft">{store.config.source}</span>
                </p>
              </div>
            </div>
          </div>

          {!hideLensTabs && (
          <div className="entity-tabs" role="tablist" aria-label="Entity lenses">
            {tabs
              .filter((t) => !t.hide)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === t.id}
                  className={`entity-tab ${activeTab === t.id ? 'on' : ''}`}
                  onClick={() => {
                    onTab(t.id)
                    t.run()
                  }}
                >
                  {t.label}
                </button>
              ))}
          </div>
          )}
        </>
      )}
    </header>
  )
}
