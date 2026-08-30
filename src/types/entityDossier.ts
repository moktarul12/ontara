import type { EntityKind, ArticleSection, InfoboxRow } from './entityArticle'
import type { CategoryContent } from './entityTemplate'
import type { AiEntityProfile } from './aiEntityProfile'

export type DossierTabId =
  | 'summary'
  | 'life'
  | 'career'
  | 'family'
  | 'works'
  | 'awards'
  | 'sources'

export type WikipediaLink = { label: string; url: string }

export type WikipediaContent = {
  sections: ArticleSection[]
  infobox: InfoboxRow[]
  leadText: string
  externalLinks: WikipediaLink[]
  categories: string[]
}

export type QuickFact = { label: string; value: string; values?: string[] }

export type HeroMetric = { label: string; value: string; icon: 'film' | 'award' | 'star' | 'years' }

export type HeroFactPill = { label: string; value: string }

export type QuickFactsCardItem = { label: string; value: string }

export type Milestone = { year?: string; label: string; detail?: string }

export type FactGroup = { label: string; values: string[] }

export type LinkedPerson = { name: string; relation: string; uri?: string; imageUrl?: string }

export type WorkCard = { year?: string; title: string; role?: string; uri?: string; imageUrl?: string }

export type AwardCard = { year?: string; name: string; result: 'won' | 'nominated' }

export type SourceRef = { label: string; url: string; source: string }

export type CareerSubtrack = {
  id: string
  title: string
  summary?: string
  highlights: string[]
}

export type CareerEra = { era: string; title: string; description?: string }

export type StoryBeat = { icon: string; label: string; detail: string; verified?: boolean }

export type FactSource = 'wikidata' | 'wikipedia' | 'dbpedia'

export type VerifiedFact = {
  label: string
  value: string
  values?: string[]
  sources: FactSource[]
  status: 'confirmed' | 'reported'
}

export type SourceTrust = {
  sources: FactSource[]
  confirmedCount: number
  reportedCount: number
  totalFacts: number
}

export type EntityDossier = {
  uri: string
  qid?: string
  label: string
  kind: EntityKind
  language: string
  hero: {
    imageUrl?: string
    subtitle?: string
    intro?: string
    metrics: HeroMetric[]
    factPills: HeroFactPill[]
    quickFactsCard: QuickFactsCardItem[]
  }
  availableTabs: DossierTabId[]
  summary: {
    readingHook?: string
    storyParagraph?: string
    about?: string
    aboutSource?: string
    sourceTrust: SourceTrust
    verifiedFacts: VerifiedFact[]
    storyBeats: StoryBeat[]
    personalDetails: QuickFact[]
    careerEras: CareerEra[]
    quote?: string
    topWorks: WorkCard[]
    topAwards: AwardCard[]
    familyPreview: LinkedPerson[]
    website?: string
    imdbUrl?: string
  }
  life: {
    timeline: Milestone[]
    facts: FactGroup[]
    narrative?: string
    narrativeSource?: string
  }
  career: {
    summary?: string
    subtracks: CareerSubtrack[]
    facts: FactGroup[]
    narrative?: string
    narrativeSource?: string
  }
  family: {
    members: LinkedPerson[]
    narrative?: string
  }
  works: {
    items: WorkCard[]
    totalCount: number
  }
  awards: {
    won: AwardCard[]
    nominated: AwardCard[]
  }
  sources: SourceRef[]
  wikipediaUrl?: string
  wikidataUrl?: string
  enriched: boolean
  /** Full Wikipedia article sections, infobox, and external links. */
  wikipedia?: WikipediaContent
  /** Category-wise template sections + AI narratives (person / org / work). */
  categoryContent?: CategoryContent
  /** Full OpenAI-generated profile (cached server-side as data/ai-cache/Q{id}.json). */
  aiProfile?: AiEntityProfile
}

export const DOSSIER_TAB_LABELS: Record<DossierTabId, string> = {
  summary: 'Summary',
  life: 'Life',
  career: 'Career',
  family: 'Family',
  works: 'Works',
  awards: 'Awards',
  sources: 'Sources',
}

export const PERSON_TABS: DossierTabId[] = [
  'summary',
  'life',
  'career',
  'family',
  'works',
  'awards',
  'sources',
]
