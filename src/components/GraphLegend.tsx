import { HOP_STYLE } from '../utils/nodeKind'
import { CLUSTER_PALETTE } from '../services/ontologyHops'

/** Simple legend for the proper KG model. */
export function GraphLegend() {
  return (
    <aside className="graph-legend" aria-label="Graph legend">
      <p className="legend-title">How to read this map</p>
      <ul>
        <li>
          <span
            className="legend-swatch"
            style={{ background: '#fff8eb', borderColor: '#c07818' }}
          />
          <span>Focus person or title</span>
        </li>
        <li>
          <span
            className="legend-swatch pill"
            style={{ background: CLUSTER_PALETTE[0].fill, borderColor: CLUSTER_PALETTE[0].border }}
          />
          <span>Link type (e.g. child, cast)</span>
        </li>
        <li>
          <span
            className="legend-swatch"
            style={{
              background: '#ffffff',
              borderColor: CLUSTER_PALETTE[0].border,
            }}
          />
          <span>Related person / place / work</span>
        </li>
      </ul>
      <p className="legend-title spaced">Distance from focus</p>
      <ul>
        {([0, 1, 2, 3] as const).map((h) => (
          <li key={h}>
            <span
              className="legend-swatch thin"
              style={{
                background: HOP_STYLE[h].fill,
                borderColor: HOP_STYLE[h].border,
              }}
            />
            <span>{HOP_STYLE[h].label}</span>
          </li>
        ))}
      </ul>
      <p className="legend-note">
        Click a name for a few more links on the map and full details on the right. Use Family tree
        or Movie credits for a focused layout. Arrow heads show direction.
      </p>
    </aside>
  )
}
