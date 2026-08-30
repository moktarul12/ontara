import type { InfoboxRow } from '../../types/entityArticle'
import type { EntityKind } from '../../types/entityArticle'

export function InfoboxPanel({
  rows,
  label,
  kind,
  imageUrl,
}: {
  rows: InfoboxRow[]
  label: string
  kind: EntityKind
  imageUrl?: string
}) {
  if (!rows.length) return null

  return (
    <aside className="wiki-infobox kx-infobox-panel" aria-label="Infobox">
      {imageUrl && (
        <div className="wiki-infobox-photo">
          <img src={imageUrl} alt="" loading="lazy" />
        </div>
      )}
      <div className="wiki-infobox-head">
        <strong>{label}</strong>
        <span className="wiki-infobox-kind">{kind}</span>
      </div>
      <table className="wiki-infobox-table">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              <td>
                {row.values.map((v, i) => (
                  <span key={`${v.text}-${i}`}>
                    {i > 0 && ', '}
                    {v.href ? (
                      <a href={v.href} target="_blank" rel="noreferrer">
                        {v.text}
                      </a>
                    ) : (
                      v.text
                    )}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </aside>
  )
}

export function InfoboxCompact({
  rows,
  limit = 6,
  onSeeAll,
}: {
  rows: InfoboxRow[]
  limit?: number
  onSeeAll?: () => void
}) {
  if (!rows.length) return null
  const slice = rows.slice(0, limit)

  return (
    <section className="kx-section kx-infobox-compact">
      <header className="kx-section-head">
        <h2>Infobox</h2>
        <p>Structured facts from Wikipedia &amp; Wikidata</p>
        {onSeeAll && (
          <button type="button" className="kx-btn-ghost kx-sources-see-all" onClick={onSeeAll}>
            Full infobox →
          </button>
        )}
      </header>
      <table className="wiki-infobox-table">
        <tbody>
          {slice.map((row) => (
            <tr key={row.label}>
              <th>{row.label}</th>
              <td>{row.values.map((v) => v.text).join(', ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
