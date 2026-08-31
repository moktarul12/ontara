import type { EntityDossier } from '../../types/entityDossier'
import type { ArticleSection } from '../../types/entityArticle'
import { ArticleTableView } from '../ArticleBody'
import type { OverviewSectionDef } from '../../services/overviewSections'
import { wikiSectionParagraphCount } from '../../services/wikiSectionNav'
import {
  cleanWikiSectionTitle,
  cleanWikiParagraphText,
  normalizeSectionParagraphs,
} from '../../utils/sectionParagraphs'
import {
  isEraTimelineTitle,
  isHistoryChapter,
  splitTimelineParagraph,
} from '../../utils/wikiTimelineParagraphs'

function WikiParagraphs({
  paragraphs,
  historyMode,
  leadClass = 'ke-wiki-chapter-p',
}: {
  paragraphs: string[]
  historyMode?: boolean
  leadClass?: string
}) {
  return (
    <>
      {paragraphs.map((p, i) => {
        if (historyMode) {
          const { heading, body } = splitTimelineParagraph(p)
          if (heading) {
            return (
              <div key={i} className="corpus-timeline-entry">
                <h4 className="corpus-timeline-date">{heading}</h4>
                <p className="ke-wiki-chapter-p">{body}</p>
              </div>
            )
          }
        }
        return (
          <p key={i} className={i === 0 && leadClass !== 'ke-wiki-chapter-p' ? leadClass : 'ke-wiki-chapter-p'}>
            {p}
          </p>
        )
      })}
    </>
  )
}

function SubsectionBlock({
  section,
  depth = 0,
  historyMode = false,
}: {
  section: ArticleSection
  depth?: number
  historyMode?: boolean
}) {
  const eraHeading = historyMode && isEraTimelineTitle(section.title)
  const Heading = eraHeading ? 'h3' : section.level === 3 ? 'h3' : 'h4'
  const paragraphs =
    section.source === 'wikipedia'
      ? (section.paragraphs ?? []).map(cleanWikiParagraphText).filter((p) => p.length > 12)
      : normalizeSectionParagraphs(section.paragraphs ?? [])
  return (
    <section
      className={`ke-wiki-subsection depth-${depth}${historyMode ? ' is-history-era' : ''}${eraHeading ? ' is-era-heading' : ''}`}
    >
      <Heading className={eraHeading ? 'corpus-timeline-era' : undefined}>
        {cleanWikiSectionTitle(section.title)}
      </Heading>
      <WikiParagraphs paragraphs={paragraphs} historyMode={historyMode} />
      {section.tables?.map((t) => (
        <ArticleTableView key={t.id} table={t} />
      ))}
      {section.children.map((child) => (
        <SubsectionBlock key={child.id} section={child} depth={depth + 1} historyMode={historyMode} />
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
  const paragraphs = embedded
    ? (section.paragraphs ?? []).map(cleanWikiParagraphText).filter((p) => p.length > 12)
    : normalizeSectionParagraphs(section.paragraphs ?? [])
  const title = cleanWikiSectionTitle(section.title)
  const historyMode = embedded && isHistoryChapter(section)
  const wordCount = paragraphs.join(' ').split(/\s+/).filter(Boolean).length
  const subCount = section.children.length
  const showIntroParagraphs = !(historyMode && section.children.length > 0)

  const renderParagraphs = () => {
    if (!paragraphs.length || !showIntroParagraphs) return null

    if (embedded) {
      return (
        <div className="ke-wiki-chapter-body is-embedded-body">
          <WikiParagraphs
            paragraphs={paragraphs}
            historyMode={historyMode}
            leadClass="ke-wiki-chapter-lead"
          />
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
    <article className={`ke-wiki-chapter ${embedded ? 'is-embedded' : ''}${historyMode ? ' is-history-chapter' : ''}`}>
      <header className="ke-wiki-chapter-head">
        {!historyMode && (
        <div className="ke-wiki-chapter-meta">
          <span className="ke-wiki-chapter-eyebrow">
            {section.source === 'wikipedia' ? 'Wikipedia' : dossier.aiProfile?.source === 'llm' || dossier.aiProfile?.source === 'cache'
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
        )}
        <h1 className={`ke-wiki-chapter-title${historyMode ? ' corpus-wiki-section-title' : ''}`}>{title}</h1>
        {!embedded && renderParagraphs()}
      </header>

      {embedded && renderParagraphs()}

      {section.tables?.map((t) => (
        <ArticleTableView key={t.id} table={t} />
      ))}

      {section.children.length > 0 && (
        <div className="ke-wiki-chapter-subs">
          {section.children.map((child) => (
            <SubsectionBlock key={child.id} section={child} historyMode={historyMode} />
          ))}
        </div>
      )}

      {!embedded && (
        <footer className="ke-wiki-chapter-foot">
          {section.source !== 'wikipedia' && (
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
      )}

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
