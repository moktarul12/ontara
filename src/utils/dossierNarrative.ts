import type { EntityDossier } from '../types/entityDossier'
import { decodeHtmlEntities } from './htmlToText'

function pickText(...candidates: (string | undefined)[]): string | undefined {
  for (const c of candidates) {
    const t = c?.trim()
    if (t && t.length > 20) return decodeHtmlEntities(t)
  }
  return undefined
}

/** Prefer AI/template summary, then dossier fallbacks. */
export function resolveSummaryNarrative(dossier: EntityDossier): string | undefined {
  return pickText(
    dossier.aiProfile?.summary.thirtySecond,
    dossier.aiProfile?.summary.narrative,
    dossier.categoryContent?.summaryNarrative,
    dossier.summary.storyParagraph,
    dossier.summary.readingHook,
    dossier.summary.about,
    dossier.hero.intro,
    dossier.wikipedia?.leadText,
    dossier.hero.subtitle,
  )
}

/** Wikipedia-first lead for article reading (Corpus / Info Hub style). */
export function resolveArticleLead(dossier: EntityDossier): string | undefined {
  return pickText(
    dossier.wikipedia?.leadParagraphs?.[0],
    dossier.wikipedia?.leadText,
    dossier.summary.about,
    dossier.hero.intro,
    dossier.aiProfile?.summary.thirtySecond,
    dossier.summary.storyParagraph,
    dossier.summary.readingHook,
    dossier.hero.subtitle,
  )
}

/** Full Wikipedia lead section for Overview (section 0 paragraphs). */
export function resolveArticleLeadParagraphs(dossier: EntityDossier): string[] {
  const fromWiki = dossier.wikipedia?.leadParagraphs?.map((p) => p.trim()).filter(Boolean) ?? []
  if (fromWiki.length) return fromWiki.map(decodeHtmlEntities)
  const single = resolveArticleLead(dossier)
  return single ? [single] : []
}

/** Section narrative from category template, if present. */
export function sectionNarrative(
  dossier: EntityDossier,
  sectionId: string,
): string | undefined {
  return dossier.categoryContent?.sections.find((s) => s.id === sectionId)?.narrative
}
