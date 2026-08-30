/** How to read Ontopedian's own atlas, not a generic box graph. */
export function GraphLegend() {
  return (
    <aside className="graph-legend atlas-legend" aria-label="Graph legend">
      <p className="legend-title">Ontopedian atlas</p>
      <ul>
        <li>
          <span className="legend-shape oval" />
          <span>Person / focus</span>
        </li>
        <li>
          <span className="legend-shape tag" />
          <span>Link type (child, cast…)</span>
        </li>
        <li>
          <span className="legend-shape hex" />
          <span>Place</span>
        </li>
        <li>
          <span className="legend-shape barrel" />
          <span>Work / film</span>
        </li>
        <li>
          <span className="legend-shape diamond" />
          <span>Topic</span>
        </li>
      </ul>
      <p className="legend-note">
        Petals = how someone is linked. Click a name to glow it and pull every connection type
        onto the map. Tree / Pedigree / Cascade for family trees.
      </p>
    </aside>
  )
}
