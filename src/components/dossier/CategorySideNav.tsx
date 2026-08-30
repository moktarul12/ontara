import { useEffect, useState } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityTab } from '../EntityHeader'
import {
  categorySections,
  lensNavItems,
  scrollToCategorySection,
  type CategorySectionId,
} from './categoryNav'

export function CategorySideNav({
  kind,
  onLens,
}: {
  kind: EntityKind
  onLens: (tab: EntityTab) => void
}) {
  const sections = categorySections(kind)
  const lenses = lensNavItems(kind)
  const [active, setActive] = useState<CategorySectionId>('profile')

  useEffect(() => {
    const targets = sections.map((s) => document.getElementById(s.targetId)).filter(Boolean)
    if (!targets.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) {
          const hit = sections.find((s) => s.targetId === visible.target.id)
          if (hit) setActive(hit.id)
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5] },
    )

    for (const el of targets) observer.observe(el!)
    return () => observer.disconnect()
  }, [sections])

  if (!sections.length) return null

  return (
    <nav className="category-side-nav" aria-label="Category sections">
      <p className="category-side-label">Overview</p>
      <ul className="category-side-list">
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              className={`category-side-item ${active === s.id ? 'active' : ''}`}
              onClick={() => {
                setActive(s.id)
                scrollToCategorySection(s.targetId)
              }}
            >
              <span className="category-side-icon" aria-hidden>
                {s.icon}
              </span>
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="category-side-label">Explore</p>
      <ul className="category-side-list category-side-lenses">
        {lenses.map((l) => (
          <li key={l.id}>
            <button type="button" className="category-side-item lens" onClick={() => onLens(l.id)}>
              <span className="category-side-icon" aria-hidden>
                {l.icon}
              </span>
              <span>{l.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
