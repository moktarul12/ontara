import type { ArticleSection, ArticleTable } from '../types/entityArticle'

function ArticleTableView({ table }: { table: ArticleTable }) {
  return (
    <div className="wiki-table-wrap">
      <h4 className="wiki-table-title">{table.title}</h4>
      <table className="wiki-table">
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i}>
              {table.columns.map((c) => (
                <td key={c.key}>{row[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionBlock({ section, depth = 0 }: { section: ArticleSection; depth?: number }) {
  const Heading = section.level === 2 ? 'h2' : section.level === 3 ? 'h3' : 'h4'
  const headingClass =
    section.level === 2 ? 'wiki-h2' : section.level === 3 ? 'wiki-h3' : 'wiki-h4'

  return (
    <article className={`wiki-section depth-${depth}`} id={section.id}>
      <Heading className={headingClass}>{section.title}</Heading>
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="wiki-p">
          {p}
        </p>
      ))}
      {section.tables?.map((t) => (
        <ArticleTableView key={t.id} table={t} />
      ))}
      {section.children.map((child) => (
        <SectionBlock key={child.id} section={child} depth={depth + 1} />
      ))}
    </article>
  )
}

export { ArticleTableView, SectionBlock }
