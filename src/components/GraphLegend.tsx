import { HOP_STYLE } from '../utils/nodeKind'
import { CLUSTER_PALETTE } from '../services/ontologyHops'

/** Simple legend for the proper KG model. */
export function GraphLegend() {
  return (
    <aside className="graph-legend" aria-label="Graph legend">
      <p className="legend-title">How to read</p>
      <ul>
        <li>
          <span
            className="legend-swatch"
            style={{ background: '#14282c', borderColor: '#e8c56a' }}
          />
          <span>Seed entity</span>
        </li>
        <li>
          <span
            className="legend-swatch pill"
            style={{ background: CLUSTER_PALETTE[0].fill, borderColor: CLUSTER_PALETTE[0].border }}
          />
          <span>Property chip</span>
        </li>
        <li>
          <span
            className="legend-swatch"
            style={{
              background: CLUSTER_PALETTE[0].valueFill,
              borderColor: CLUSTER_PALETTE[0].border,
            }}
          />
          <span>Value (same colour family)</span>
        </li>
      </ul>
      <p className="legend-title spaced">Entity hops</p>
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
        Arrows mark source → destination. Portraits import from Wikidata — not as graph nodes.
        Hop = entity distance; property chips are not an extra hop.
      </p>
    </aside>
  )
}
