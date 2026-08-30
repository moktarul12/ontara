export type AppNavId = 'explore'

interface Props {
  active: AppNavId
  onNavigate: (id: AppNavId) => void
  onHome: () => void
  sourceLabel: string
  collapsed: boolean
  onToggleCollapse: () => void
}

export function AppNav({
  active,
  onNavigate,
  onHome,
  sourceLabel,
  collapsed,
  onToggleCollapse,
}: Props) {
  return (
    <aside
      className={`app-nav ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Main navigation"
    >
      <div className="bar-chrome">
        <button type="button" className="app-nav-brand" onClick={onHome} title="Ontopedian home">
          <span className="app-nav-mark" aria-hidden />
          {!collapsed && <span className="app-nav-name">Ontopedian</span>}
        </button>
        <button
          type="button"
          className="bar-toggle"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          <span className={`chevron ${collapsed ? 'chevron-right' : 'chevron-left'}`} aria-hidden />
        </button>
      </div>

      <nav className="app-nav-list">
        <button
          type="button"
          className={`app-nav-item ${active === 'explore' ? 'on' : ''}`}
          title="Explore & search"
          onClick={() => onNavigate('explore')}
        >
          <span className="app-nav-ico ico-explore" aria-hidden />
          {!collapsed && <span className="app-nav-label">Explore</span>}
        </button>
      </nav>

      {!collapsed && (
        <div className="app-nav-foot">
          <div className="app-nav-user">
            <span className="app-nav-avatar" aria-hidden>
              O
            </span>
            <div>
              <p className="app-nav-user-name">Ontopedian</p>
              <p className="app-nav-user-plan">{sourceLabel}</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
