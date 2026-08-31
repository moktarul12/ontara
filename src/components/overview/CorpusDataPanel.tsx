import { useMemo, useState } from 'react'
import type { EntityDossier } from '../../types/entityDossier'
import { buildCorpusDataStats, type CorpusYearOutput } from '../../services/corpusDataBuilder'

function OutputChart({
  rows,
  chartMax,
}: {
  rows: CorpusYearOutput[]
  chartMax: number
}) {
  const [hover, setHover] = useState<CorpusYearOutput | null>(null)

  if (!rows.length) return null

  const pad = { l: 28, r: 8, t: 12, b: 28 }
  const w = 720
  const h = 220
  const innerW = w - pad.l - pad.r
  const innerH = h - pad.t - pad.b
  const barW = Math.max(4, Math.min(14, innerW / rows.length - 2))
  const gap = (innerW - barW * rows.length) / Math.max(1, rows.length - 1)

  const yTicks = [0, Math.round(chartMax / 4), Math.round(chartMax / 2), Math.round((chartMax * 3) / 4), chartMax]

  return (
    <div className="corpus-output-chart-wrap">
      <svg
        className="corpus-output-chart"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Output by year chart"
      >
        {yTicks.map((tick) => {
          const y = pad.t + innerH - (tick / chartMax) * innerH
          return (
            <g key={tick}>
              <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} className="corpus-chart-grid" />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" className="corpus-chart-y-label">
                {tick}
              </text>
            </g>
          )
        })}

        {rows.map((row, i) => {
          const x = pad.l + i * (barW + gap)
          const worksH = (row.works / chartMax) * innerH
          const awardsH = (row.awardsWon / chartMax) * innerH
          const nomH = (row.nominations / chartMax) * innerH
          const baseY = pad.t + innerH
          const totalH = worksH + awardsH + nomH
          const yWorks = baseY - totalH
          const yAwards = baseY - awardsH - nomH
          const yNom = baseY - nomH

          return (
            <g
              key={row.year}
              onMouseEnter={() => setHover(row)}
              onMouseLeave={() => setHover(null)}
            >
              {row.nominations > 0 && (
                <rect
                  x={x}
                  y={yNom}
                  width={barW}
                  height={nomH}
                  className="corpus-chart-bar nominations"
                  rx={2}
                />
              )}
              {row.awardsWon > 0 && (
                <rect
                  x={x}
                  y={yAwards}
                  width={barW}
                  height={awardsH}
                  className="corpus-chart-bar awards"
                  rx={2}
                />
              )}
              {row.works > 0 && (
                <rect
                  x={x}
                  y={yWorks}
                  width={barW}
                  height={worksH}
                  className="corpus-chart-bar works"
                  rx={2}
                />
              )}
              {(i === 0 || row.year % 3 === 0) && (
                <text x={x + barW / 2} y={h - 8} textAnchor="middle" className="corpus-chart-x-label">
                  {row.year}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {hover && (
        <div className="corpus-chart-tooltip">
          <strong>{hover.year}</strong>
          <span>
            <i className="swatch works" /> Works released: {hover.works}
          </span>
          <span>
            <i className="swatch awards" /> Awards won: {hover.awardsWon}
          </span>
          <span>
            <i className="swatch nominations" /> Nominations: {hover.nominations}
          </span>
        </div>
      )}

      <div className="corpus-chart-legend">
        <span>
          <i className="swatch works" /> Works released
        </span>
        <span>
          <i className="swatch awards" /> Awards won
        </span>
        <span>
          <i className="swatch nominations" /> Nominations
        </span>
      </div>
    </div>
  )
}

export function CorpusDataPanel({ dossier }: { dossier: EntityDossier }) {
  const stats = useMemo(() => buildCorpusDataStats(dossier), [dossier])

  return (
    <section className="corpus-data-panel">
      <div className="corpus-data-stats">
        <article className="corpus-stat-card">
          <span className="corpus-stat-label">Works</span>
          <strong>{stats.worksCount}</strong>
        </article>
        <article className="corpus-stat-card">
          <span className="corpus-stat-label">Awards won</span>
          <strong>{stats.awardsWon}</strong>
        </article>
        <article className="corpus-stat-card">
          <span className="corpus-stat-label">Nominations</span>
          <strong>{stats.nominations}</strong>
        </article>
        <article className="corpus-stat-card">
          <span className="corpus-stat-label">Active span</span>
          <strong>{stats.activeSpan ?? '—'}</strong>
        </article>
      </div>

      {stats.busiestYear && stats.busiestYear.count > 0 && (
        <article className="corpus-busiest-card">
          <span className="corpus-stat-label">Busiest year</span>
          <strong>{stats.busiestYear.label}</strong>
        </article>
      )}

      {stats.yearlyOutput.length > 0 && (
        <article className="corpus-chart-card">
          <header>
            <h2>Output by year</h2>
            <p>Released works, awards won and nominations per year</p>
          </header>
          <OutputChart rows={stats.yearlyOutput} chartMax={stats.chartMax} />
        </article>
      )}
    </section>
  )
}
