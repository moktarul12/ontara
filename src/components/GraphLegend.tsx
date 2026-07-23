import { HOP_STYLE, KIND_STYLE, type NodeKind } from '../utils/nodeKind'

const KIND_KEYS: NodeKind[] = ['person', 'work', 'concept', 'place', 'org', 'class', 'relation']

/** Legend for informative fact-card graph. */
export function GraphLegend() {
  return (
    <aside className="graph-legend" aria-label="Graph legend">
      <p className="legend-title">Read the cards</p>
      <p className="legend-note tight">
        Title · kind/type · hop + links. Gold = seed. Colour = what it is.
      </p>
      <ul className="legend-kinds">
        {KIND_KEYS.map((k) => (
          <li key={k}>
            <span
              className="legend-swatch"
              style={{
                background: KIND_STYLE[k].fill,
                borderColor: KIND_STYLE[k].border,
              }}
            />
            <span>{KIND_STYLE[k].label}</span>
          </li>
        ))}
      </ul>
      <p className="legend-title spaced">Hops</p>
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
    </aside>
  )
}
