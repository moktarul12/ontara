import { useEffect, useRef, useState } from 'react'
import type { EntityDossier } from '../../types/entityDossier'
import type { OverviewSectionId } from '../../services/overviewSections'
import { wikiOverviewSections } from '../../services/overviewSections'
import {
  adjacentWikiSections,
  findWikiSectionByNavId,
  isWikiSectionId,
} from '../../services/wikiSectionNav'
import { mergeAiIntoWikiSection } from '../../services/applyAiEntityProfile'
import { WikiSectionView } from '../overview/WikiSectionView'

export function ReaderChapterDeck({
  dossier,
  activeId: controlledActiveId,
  onActiveChange,
}: {
  dossier: EntityDossier
  activeId?: OverviewSectionId | null
  onActiveChange?: (id: OverviewSectionId) => void
}) {
  const chapters = wikiOverviewSections(dossier.kind, dossier)
  const [internalActiveId, setInternalActiveId] = useState<OverviewSectionId | null>(null)
  const paneRef = useRef<HTMLDivElement>(null)

  const activeId = controlledActiveId ?? internalActiveId

  useEffect(() => {
    if (!chapters.length) {
      if (!onActiveChange) setInternalActiveId(null)
      return
    }
    const first = chapters[0].id
    const current = controlledActiveId ?? internalActiveId
    if (!current || !chapters.some((c) => c.id === current)) {
      if (onActiveChange) onActiveChange(first)
      else setInternalActiveId(first)
    }
  }, [dossier.uri, dossier.language, chapters, controlledActiveId, internalActiveId, onActiveChange])

  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 })
  }, [activeId])

  if (!chapters.length || !activeId) return null

  const pickChapter = (id: OverviewSectionId) => {
    if (onActiveChange) onActiveChange(id)
    else setInternalActiveId(id)
  }

  const wikiId = isWikiSectionId(activeId) ? activeId : null
  const raw = wikiId ? findWikiSectionByNavId(dossier, wikiId) : null
  const section = raw && wikiId ? mergeAiIntoWikiSection(dossier, raw, wikiId) : null
  const { prev, next } = wikiId ? adjacentWikiSections(dossier, wikiId) : {}

  return (
    <section className="or-chapters or-chapter-split" id="or-chapters">
      <header className="or-section-head">
        <div>
          <p className="or-kicker">Deep dive</p>
          <h2 className="or-section-title">Keep reading</h2>
          <p className="or-section-dek">
            Pick a chapter on the left — the full story opens on the right
          </p>
        </div>
      </header>

      <div className="or-chapter-split-layout">
        <nav className="or-chapter-tabs" aria-label="Article chapters">
          <p className="or-chapter-tabs-label">Chapters</p>
          <ul className="or-chapter-tab-list" role="tablist">
            {chapters.map((ch, i) => {
              const selected = activeId === ch.id
              const preview = ch.previewHint?.(dossier)
              return (
                <li key={ch.id} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    id={`or-tab-${ch.id}`}
                    aria-selected={selected}
                    aria-controls="or-chapter-panel"
                    className={`or-chapter-tab ${selected ? 'active' : ''}`}
                    onClick={() => pickChapter(ch.id)}
                  >
                    <span className="or-chapter-tab-num">{String(i + 1).padStart(2, '0')}</span>
                    <span className="or-chapter-tab-text">
                      <strong>{ch.navLabel}</strong>
                      {preview && !selected && <span className="or-chapter-tab-preview">{preview}</span>}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div
          ref={paneRef}
          className="or-chapter-pane"
          id="or-chapter-panel"
          role="tabpanel"
          aria-labelledby={`or-tab-${activeId}`}
        >
          {section ? (
            <WikiSectionView
              section={section}
              dossier={dossier}
              prev={prev}
              next={next}
              embedded
              onSection={pickChapter}
            />
          ) : (
            <p className="or-chapter-empty muted">Select a chapter to begin reading.</p>
          )}
        </div>
      </div>
    </section>
  )
}
