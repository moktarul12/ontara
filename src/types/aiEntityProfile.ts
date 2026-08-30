import type { EntityKind } from './entityArticle'

export type AiTimelineEvent = {
  year?: string
  label: string
  detail: string
  era?: string
}

export type AiWikiSubsection = {
  title: string
  paragraphs: string[]
}

export type AiWikiChapter = {
  id: string
  title: string
  lead: string
  paragraphs: string[]
  subsections?: AiWikiSubsection[]
}

export type AiEntityProfile = {
  qid: string
  label: string
  kind: EntityKind
  lang: string
  source: 'llm' | 'template' | 'hybrid' | 'cache'
  generatedAt: string
  cacheVersion: 1
  summary: {
    hook: string
    thirtySecond: string
    narrative: string
  }
  timeline: AiTimelineEvent[]
  history: {
    narrative: string
    eras?: { era: string; title: string; description: string }[]
  }
  chapters: AiWikiChapter[]
  highlights?: { label: string; detail: string }[]
  generationError?: string
}

export type AiEntityProfileRequest = {
  qid: string
  label: string
  kind: EntityKind
  lang: string
  wikiLead?: string
  facts: { label: string; value: string }[]
  wikiSections?: { id: string; title: string; excerpt?: string }[]
  force?: boolean
}

export type AiEntityProfileResponse = AiEntityProfile & {
  fromCache?: boolean
}
