import { HOP_STYLE } from '../utils/nodeKind'

/** Legend for entity-distance hops (max 5). */
export function GraphLegend() {
  const hops = [0, 1, 2, 3, 4, 5] as const

  return (
    <aside className="graph-legend" aria-label="Ontology hop legend">
      <p className="legend-title">Ontology hops</p>
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
        Each hop = property hubs + values at that distance. Out / In / Both choose direction.
        Matching colours = same property cluster.
      </p>
    </aside>
  )
}
