import type { ReactNode } from 'react'
import type { EntityKind } from '../../types/entityArticle'
import type { EntityTab } from '../EntityHeader'
import { CategorySideNav } from './CategorySideNav'

export function CategoryWorkbench({
  kind,
  hero,
  children,
  onLens,
}: {
  kind: EntityKind
  hero: ReactNode
  children: ReactNode
  onLens: (tab: EntityTab) => void
}) {
  return (
    <div className="category-workbench">
      <CategorySideNav kind={kind} onLens={onLens} />
      <div className="category-workbench-main">
        {hero}
        {children}
      </div>
    </div>
  )
}
