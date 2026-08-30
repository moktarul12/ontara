import type { EntityDossier } from '../../types/entityDossier'
import type { ArticleSection } from '../../types/entityArticle'
import { ArticleTableView } from '../ArticleBody'
import type { OverviewSectionDef } from '../../services/overviewSections'
import { wikiSectionParagraphCount } from '../../services/wikiSectionNav'
import {
  cleanWikiSectionTitle,
  normalizeSectionParagraphs,
} from '../../utils/sectionParagraphs'

function SubsectionBlock({ section, depth = 0 }: { section: ArticleSection; depth?: number }) {
  const Heading = section.level === 3 ? 'h3' : 'h4'
  const paragraphs = normalizeSectionParagraphs(section.paragraphs ?? [])
  return (
    <section className={`ke-wiki-subsection depth-${depth}`}>
      <Heading>{cleanWikiSectionTitle(section.title)}</Heading>
      {paragraphs.map((p, i) => (
        <p key={i} className="ke-wiki-chapter-p">
          {p}
        </p>
      ))}
      {section.tables?.map((t) => (
        <ArticleTableView key={t.id} table={t} />
      ))}
      {section.children.map((child) => (
        <SubsectionBlock key={child.id} section={child} depth={depth + 1} />
      ))}
    </section>
  )
}

export function WikiSectionView({
  section,
  dossier,
  prev,
  next,
  onSection,
  embedded = false,
}: {
  section: ArticleSection
  dossier: EntityDossier
  prev?: OverviewSectionDef
  next?: OverviewSectionDef
  onSection: (id: OverviewSectionDef['id']) => void
  embedded?: boolean
}) {
  const paragraphs = normalizeSectionParagraphs(section.paragraphs ?? [])
  const title = cleanWikiSectionTitle(section.title)
  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length
  const subCount = section.children.length

  const renderParagraphs = () => {
    if (!paragraphs.length) return null

    if (embedded) {
      return (
        <div className="ke-wiki-chapter-body is-embedded-body">
          {paragraphs.map((p, i) => (
            <p key={i} className={i === 0 ? 'ke-wiki-chapter-lead' : 'ke-wiki-chapter-p'}>
              {p}
            </p>
          ))}
        </div>
      )
    }

    const lead = paragraphs[0]
    const body = paragraphs.slice(1)
    return (
      <>
        {lead && <p className="ke-wiki-chapter-lead">{lead}</p>}
        {body.length > 0 && (
          <div className="ke-wiki-chapter-body">
            {body.map((p, i) => (
              <p key={i} className="ke-wiki-chapter-p">
                {p}
              </p>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <article className={`ke-wiki-chapter ${embedded ? 'is-embedded' : ''}`}>
      <header className="ke-wiki-chapter-head">
        <div className="ke-wiki-chapter-meta">
          <span className="ke-wiki-chapter-eyebrow">
            {dossier.aiProfile?.source === 'llm' || dossier.aiProfile?.source === 'cache'
              ? 'AI editorial'
              : 'Wikipedia'}
          </span>
          {!embedded && (
            <span className="ke-wiki-chapter-stats">
              {wordCount > 0 && `${wordCount} words`}
              {subCount > 0 && ` · ${subCount} subsection${subCount === 1 ? '' : 's'}`}
            </span>
          )}
        </div>
        <h1 className="ke-wiki-chapter-title">{title}</h1>
        {!embedded && renderParagraphs()}
      </header>

      {embedded && renderParagraphs()}

      {section.tables?.map((t) => (
        <ArticleTableView key={t.id} table={t} />
      ))}

      {section.children.length > 0 && (
        <div className="ke-wiki-chapter-subs">
          {section.children.map((child) => (
            <SubsectionBlock key={child.id} section={child} />
          ))}
        </div>
      )}

      <footer className="ke-wiki-chapter-foot">
        {!embedded && (
          <p className="ke-wiki-chapter-note muted">
            Editorial rewrite for readability — facts preserved, wording original.{' '}
            {wikiSectionParagraphCount(section)} paragraphs in this chapter.
          </p>
        )}
        {dossier.wikipediaUrl && (
          <a
            href={`${dossier.wikipediaUrl}#${section.id}`}
            target="_blank"
            rel="noreferrer"
            className="ke-wiki-chapter-wiki-link"
          >
            Compare on Wikipedia ↗
          </a>
        )}
      </footer>

      {(prev || next) && (
        <nav className={`ke-wiki-chapter-nav ${embedded ? 'is-compact' : ''}`} aria-label="Wiki chapters">
          {prev ? (
            <button type="button" className="ke-wiki-chapter-nav-btn prev" onClick={() => onSection(prev.id)}>
              <span>← Previous</span>
              <strong>{prev.navLabel}</strong>
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" className="ke-wiki-chapter-nav-btn next" onClick={() => onSection(next.id)}>
              <span>Next →</span>
              <strong>{next.navLabel}</strong>
            </button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </article>
  )
}
