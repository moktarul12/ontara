import type { AiEntityProfile } from '../types/aiEntityProfile'
import type { EntityDossier } from '../types/entityDossier'
import type { CategoryContent } from '../types/entityTemplate'
import { type WikiSectionNavId } from '../services/wikiSectionNav'

/** Merge cached OpenAI profile into dossier for display. */
export function applyAiEntityProfile(dossier: EntityDossier, ai: AiEntityProfile): EntityDossier {
  const timeline = ai.timeline.map((t) => ({
    year: t.year,
    label: t.label,
    detail: t.detail,
  }))

  const careerEras =
    ai.history.eras?.map((e) => ({
      era: e.era,
      title: e.title,
      description: e.description,
    })) ?? dossier.summary.careerEras

  const categoryContent: CategoryContent = {
    templateId: dossier.categoryContent?.templateId ?? `${dossier.kind}-ai`,
    kind: dossier.kind,
    summaryNarrative: ai.summary.thirtySecond,
    source: ai.source === 'llm' ? 'llm' : ai.source === 'cache' ? 'hybrid' : 'template',
    sections: [
      ...(dossier.categoryContent?.sections ?? []),
      {
        id: 'history',
        title: 'History',
        layout: 'narrative',
        narrative: ai.history.narrative,
        slots: [],
        source: 'llm',
      },
      {
        id: 'timeline',
        title: 'Timeline',
        layout: 'timeline',
        narrative: ai.history.narrative.slice(0, 280),
        slots: ai.timeline.map((t, i) => ({
          id: `ai-tl-${i}`,
          label: t.label,
          value: [t.year, t.detail].filter(Boolean).join(' — '),
        })),
        source: 'llm',
      },
    ],
  }

  const wikipedia = dossier.wikipedia
    ? {
        ...dossier.wikipedia,
        // Keep Wikipedia lead and section bodies for reading; AI stays in aiProfile only.
      }
    : undefined

  return {
    ...dossier,
    aiProfile: ai,
    hero: {
      ...dossier.hero,
    },
    summary: {
      ...dossier.summary,
      readingHook: dossier.summary.readingHook,
      storyParagraph: dossier.summary.storyParagraph,
      careerEras,
      storyBeats:
        ai.highlights?.map((h) => ({
          icon: '✦',
          label: h.label,
          detail: h.detail,
          verified: true,
        })) ?? dossier.summary.storyBeats,
    },
    life: {
      ...dossier.life,
      timeline: timeline.length ? timeline : dossier.life.timeline,
      narrative: ai.history.narrative || dossier.life.narrative,
      narrativeSource: 'generated',
    },
    categoryContent,
    wikipedia,
  }
}

/** AI chapter text for a wiki nav route, if available. */
export function aiChapterForNavId(
  dossier: EntityDossier,
  navId: WikiSectionNavId,
): AiEntityProfile['chapters'][0] | undefined {
  if (!dossier.aiProfile) return undefined
  const slug = navId === 'w/introduction' ? 'introduction' : navId.slice(2)
  return (
    dossier.aiProfile.chapters.find((c) => c.id === slug) ??
    dossier.aiProfile.chapters.find((c) => c.title.toLowerCase() === slug.replace(/-/g, ' '))
  )
}

export function dossierHasAiChapter(dossier: EntityDossier, navId: WikiSectionNavId): boolean {
  return Boolean(aiChapterForNavId(dossier, navId))
}

export function mergeAiIntoWikiSection(
  dossier: EntityDossier,
  section: import('../types/entityArticle').ArticleSection,
  _navId?: WikiSectionNavId,
): import('../types/entityArticle').ArticleSection {
  // Reading UX matches Corpus: show Wikipedia sections, not AI rewrites.
  void dossier
  return section
}
