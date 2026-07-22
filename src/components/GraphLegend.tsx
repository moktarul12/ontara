import { HOP_STYLE } from '../utils/nodeKind'

/** Legend for ontology-respecting hops (Sholay-style). */
export function GraphLegend() {
  const hops = [0, 1, 2, 3] as const

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
        Entity → Property hub → Values. Matching colours = same property cluster.
      </p>
    </aside>
  )
}
