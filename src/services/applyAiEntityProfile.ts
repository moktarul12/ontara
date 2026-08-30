import type { AiEntityProfile } from '../types/aiEntityProfile'
import type { EntityDossier } from '../types/entityDossier'
import type { ArticleSection } from '../types/entityArticle'
import type { CategoryContent } from '../types/entityTemplate'
import { isWikiSectionId, type WikiSectionNavId } from '../services/wikiSectionNav'
import { normalizeSectionParagraphs } from '../utils/sectionParagraphs'

function overlaySection(section: ArticleSection, chapter: AiEntityProfile['chapters'][0]): ArticleSection {
  const paragraphs = normalizeSectionParagraphs([
    chapter.lead,
    ...(chapter.paragraphs ?? []),
  ].filter(Boolean))

  const children = section.children.map((child) => {
    const sub = chapter.subsections?.find(
      (s) => s.title.toLowerCase() === child.title.toLowerCase(),
    )
    if (!sub) return child
    const subParas = normalizeSectionParagraphs(sub.paragraphs ?? [])
    return {
      ...child,
      paragraphs: subParas,
      prose: subParas.join('\n\n'),
    }
  })

  return {
    ...section,
    paragraphs,
    prose: paragraphs.join('\n\n'),
    children,
    source: 'generated' as const,
  }
}

function overlayWikiTree(sections: ArticleSection[], chapters: AiEntityProfile['chapters']): ArticleSection[] {
  const byId = new Map(chapters.map((c) => [c.id, c]))
  const byTitle = new Map(chapters.map((c) => [c.title.toLowerCase(), c]))

  const walk = (list: ArticleSection[]): ArticleSection[] =>
    list.map((s) => {
      const chapter = byId.get(s.id) ?? byTitle.get(s.title.toLowerCase())
      let next = s
      if (chapter) next = overlaySection(s, chapter)
      return { ...next, children: walk(next.children) }
    })

  return walk(sections)
}

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
        leadText: ai.chapters.find((c) => c.id === 'introduction')?.lead ?? dossier.wikipedia.leadText,
        sections: overlayWikiTree(dossier.wikipedia.sections, ai.chapters),
      }
    : undefined

  return {
    ...dossier,
    aiProfile: ai,
    hero: {
      ...dossier.hero,
      intro: ai.summary.narrative || dossier.hero.intro,
    },
    summary: {
      ...dossier.summary,
      readingHook: ai.summary.hook || dossier.summary.readingHook,
      storyParagraph: ai.summary.narrative || dossier.summary.storyParagraph,
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
  navId?: WikiSectionNavId,
): import('../types/entityArticle').ArticleSection {
  const id = navId ?? (isWikiSectionId(`w/${section.id}`) ? `w/${section.id}` : undefined)
  const chapter = id ? aiChapterForNavId(dossier, id as WikiSectionNavId) : undefined
  if (!chapter) {
    const byTitle = dossier.aiProfile?.chapters.find(
      (c) => c.title.toLowerCase() === section.title.toLowerCase(),
    )
    if (!byTitle) return section
    return overlaySection(section, byTitle)
  }
  return overlaySection(section, chapter)
}
