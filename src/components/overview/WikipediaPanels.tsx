import type { ArticleSection } from '../../types/entityArticle'
import { SectionBlock } from '../ArticleBody'

export function WikipediaArticlePanel({ sections }: { sections: ArticleSection[] }) {
  if (!sections.length) return null

  return (
    <div className="wiki-article-body kx-wiki-article">
      {sections.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
    </div>
  )
}

export function WikipediaSectionPanel({
  sections,
  pattern,
  fallbackTitle,
}: {
  sections: ArticleSection[]
  pattern: RegExp
  fallbackTitle?: string
}) {
  const flat: ArticleSection[] = []
  const walk = (list: ArticleSection[]) => {
    for (const s of list) {
      if (pattern.test(s.title)) flat.push(s)
      walk(s.children)
    }
  }
  walk(sections)

  if (!flat.length) return null

  return (
    <div className="wiki-article-body kx-wiki-article">
      {flat.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
      {!flat.some((s) => s.paragraphs?.length) && fallbackTitle && (
        <p className="muted">No {fallbackTitle.toLowerCase()} text available on Wikipedia for this language.</p>
      )}
    </div>
  )
}

export function ExternalLinksPanel({
  links,
  categories,
}: {
  links: { label: string; url: string }[]
  categories?: string[]
}) {
  if (!links.length && !categories?.length) return null

  return (
    <div className="kx-external-panel">
      {links.length > 0 && (
        <ul className="kx-external-links">
          {links.map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noreferrer">
                {l.label}
                <span className="kx-external-url">{new URL(l.url).hostname}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {categories && categories.length > 0 && (
        <div className="kx-wiki-categories">
          <p className="person-section-label">Categories</p>
          <div className="kx-category-tags">
            {categories.map((c) => (
              <span key={c} className="kx-category-tag">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
