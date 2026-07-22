import { HOP_STYLE } from '../utils/nodeKind'

/** Legend keyed by hop ring — connected nodes share a colour. */
export function GraphLegend() {
  const hops = [0, 1, 2, 3] as const

  return (
    <aside className="graph-legend" aria-label="Hop colour legend">
      <p className="legend-title">Hop rings</p>
      <ul>
        {hops.map((h) => (
          <li key={h}>
            <span
              className="legend-swatch"
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
        Neighbours on one ring share a colour · Edges tint to the outer hop · Labels inside cards
      </p>
    </aside>
  )
}
