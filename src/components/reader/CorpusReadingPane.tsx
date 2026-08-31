import { useEffect, useMemo, useRef, useState } from 'react'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { wikiOverviewSections } from '../../services/overviewSections'
import { wikiSectionNavDefs } from '../../services/wikiSectionNav'
import {
  adjacentWikiSections,
  findWikiSectionByNavId,
  hasWikiChapterNav,
  isWikiSectionId,
} from '../../services/wikiSectionNav'
import { mergeAiIntoWikiSection } from '../../services/applyAiEntityProfile'
import { resolveArticleLead, resolveArticleLeadParagraphs } from '../../utils/dossierNarrative'
import { cleanWikiParagraphText } from '../../utils/sectionParagraphs'
import { loadWikiSectionForNav, mergeWikiSectionIntoDossier } from '../../services/wikiSectionLoader'
import type { ArticleSection } from '../../types/entityArticle'
import { WikiSectionView } from '../overview/WikiSectionView'

function navLabel(id: OverviewSectionId, label: string): string {
  return id === 'w/introduction' ? 'Overview' : label
}

function sectionHasBody(section: ArticleSection | null | undefined): boolean {
  if (!section) return false
  if ((section.paragraphs?.length ?? 0) > 0) return true
  return section.children.some((c) => sectionHasBody(c))
}

export function CorpusReadingPane({
  dossier,
  activeId: controlledActiveId,
  onActiveChange,
  onDossierPatch,
}: {
  dossier: EntityDossier
  activeId?: OverviewSectionId | null
  onActiveChange?: (id: OverviewSectionId) => void
  onDossierPatch?: (patch: (d: EntityDossier) => EntityDossier) => void
}) {
  const chapters = wikiOverviewSections(dossier.kind, dossier)
  const navDefs = wikiSectionNavDefs(dossier)
  const fallbackLead = resolveArticleLead(dossier)
  const fallbackParagraphs = resolveArticleLeadParagraphs(dossier)
  const hasContent =
    navDefs.length > 0 ||
    chapters.length > 0 ||
    Boolean(fallbackLead) ||
    hasWikiChapterNav(dossier)

  const navItems = useMemo(
    () =>
      navDefs.length
        ? navDefs.map((ch) => ({ id: ch.id, label: navLabel(ch.id, ch.navLabel) }))
        : chapters.length
          ? chapters.map((ch) => ({ id: ch.id, label: navLabel(ch.id, ch.navLabel) }))
          : fallbackLead
            ? [{ id: 'w/introduction' as OverviewSectionId, label: 'Overview' }]
            : [],
    [navDefs, chapters, fallbackLead],
  )

  const [internalActiveId, setInternalActiveId] = useState<OverviewSectionId | null>(null)
  const [loadingSection, setLoadingSection] = useState(false)
  const paneRef = useRef<HTMLDivElement>(null)

  const activeId = controlledActiveId ?? internalActiveId
  const wikiId = activeId && isWikiSectionId(activeId) ? activeId : null

  useEffect(() => {
    if (!wikiId || wikiId === 'w/introduction' || !onDossierPatch) return
    const existing = findWikiSectionByNavId(dossier, wikiId)
    if (sectionHasBody(existing)) return

    let cancelled = false
    setLoadingSection(true)
    void loadWikiSectionForNav(dossier, wikiId).then((loaded) => {
      if (cancelled) return
      if (loaded) onDossierPatch((d) => mergeWikiSectionIntoDossier(d, loaded))
      setLoadingSection(false)
    })
    return () => {
      cancelled = true
    }
  }, [dossier, wikiId, onDossierPatch])

  useEffect(() => {
    if (!navItems.length) {
      if (!onActiveChange) setInternalActiveId(null)
      return
    }
    const current = controlledActiveId ?? internalActiveId
    if (!current || !navItems.some((n) => n.id === current)) {
      const first = navItems[0].id
      if (onActiveChange) onActiveChange(first)
      else setInternalActiveId(first)
    }
  }, [dossier.uri, navItems, controlledActiveId, internalActiveId, onActiveChange])

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 })
  }, [activeId])

  if (!hasContent || !navItems.length) return null

  const pick = (id: OverviewSectionId) => {
    if (onActiveChange) onActiveChange(id)
    else setInternalActiveId(id)
  }

  const wikiIdForSection = activeId && isWikiSectionId(activeId) ? activeId : null
  const raw = wikiIdForSection ? findWikiSectionByNavId(dossier, wikiIdForSection) : null
  const section = raw && wikiIdForSection ? mergeAiIntoWikiSection(dossier, raw, wikiIdForSection) : null
  const { prev, next } = wikiIdForSection ? adjacentWikiSections(dossier, wikiIdForSection) : {}

  const fallbackSection =
    !section && activeId === 'w/introduction' && fallbackParagraphs.length
      ? {
          id: 'introduction',
          title: 'Overview',
          level: 2 as const,
          paragraphs: fallbackParagraphs.map(cleanWikiParagraphText).filter((p) => p.length > 12),
          prose: fallbackParagraphs.join('\n\n'),
          children: [],
          source: 'wikipedia' as const,
        }
      : null

  const displaySection = section ?? fallbackSection
  const sectionLoading = Boolean(
    wikiIdForSection &&
      wikiIdForSection !== 'w/introduction' &&
      (loadingSection || !sectionHasBody(displaySection)),
  )
  const wordCount = displaySection?.paragraphs?.join(' ').split(/\s+/).filter(Boolean).length ?? 0
  const readMeta = wordCount > 120 ? `${Math.max(1, Math.round(wordCount / 220))} min read` : undefined

  return (
    <section className="corpus-reading" id="corpus-reading">
      <div className="corpus-reading-layout">
        <nav className="corpus-on-page" aria-label="On this page">
          <p className="corpus-on-page-label">On this page</p>
          <ul className="corpus-on-page-list">
            {navItems.map((item) => {
              const selected = activeId === item.id
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`corpus-on-page-link ${selected ? 'active' : ''}`}
                    onClick={() => pick(item.id)}
                    aria-current={selected ? 'true' : undefined}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div ref={paneRef} className="corpus-reading-pane">
          {displaySection ? (
            <>
              {readMeta && activeId === 'w/introduction' && (
                <p className="corpus-read-meta">{readMeta}</p>
              )}
              {sectionLoading ? (
                <p className="corpus-article-empty muted">Loading section…</p>
              ) : (
                <WikiSectionView
                  section={displaySection}
                  dossier={dossier}
                  prev={prev}
                  next={next}
                  embedded
                  onSection={pick}
                />
              )}
            </>
          ) : (
            <p className="corpus-article-empty muted">Select a section to begin reading.</p>
          )}
        </div>
      </div>
    </section>
  )
}
