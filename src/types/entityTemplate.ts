import type { EntityKind } from './entityArticle'

/** A slot maps Wikidata / verified-fact labels into a template field. */
export type TemplateSlot = {
  id: string
  label: string
  factKeys: string[]
  format?: 'text' | 'list' | 'currency' | 'date' | 'rating'
}

/** One dashboard section in a category template (person / org / work). */
export type TemplateSectionDef = {
  id: string
  title: string
  subtitle?: string
  layout: 'narrative' | 'highlights' | 'grid' | 'timeline' | 'cast' | 'films' | 'awards' | 'people'
  slots: TemplateSlot[]
  aiPrompt: string
}

export type CategoryTemplate = {
  id: string
  kind: EntityKind
  label: string
  heroTone: 'blue' | 'crimson' | 'navy'
  sections: TemplateSectionDef[]
}

export type FilledSlot = {
  id: string
  label: string
  value: string
  values?: string[]
}

export type FilledSection = {
  id: string
  title: string
  subtitle?: string
  layout: TemplateSectionDef['layout']
  narrative?: string
  slots: FilledSlot[]
  source: 'template' | 'llm' | 'hybrid'
}

export type CategoryContent = {
  templateId: string
  kind: EntityKind
  sections: FilledSection[]
  summaryNarrative?: string
  source: 'template' | 'llm' | 'hybrid'
}

const ORG_TEMPLATE: CategoryTemplate = {
  id: 'org-corporate',
  kind: 'org',
  label: 'Organization',
  heroTone: 'navy',
  sections: [
    {
      id: 'summary',
      title: 'AI Summary',
      subtitle: 'Powered by cross-verified sources',
      layout: 'narrative',
      slots: [],
      aiPrompt:
        'Write a 2–3 sentence executive overview of this company: industry position, scale, leadership, and global footprint. Use only provided facts.',
    },
    {
      id: 'identity',
      title: 'Company Profile',
      layout: 'highlights',
      slots: [
        { id: 'industry', label: 'Industry', factKeys: ['industry'] },
        { id: 'founded', label: 'Founded', factKeys: ['inception', 'founded'], format: 'date' },
        { id: 'hq', label: 'Headquarters', factKeys: ['headquarters', 'headquarters location'] },
        { id: 'country', label: 'Country', factKeys: ['country', 'country of origin'] },
      ],
      aiPrompt: 'Summarize what this organization does and where it operates in one crisp sentence.',
    },
    {
      id: 'financials',
      title: 'Financial Overview',
      subtitle: 'Key figures from linked open data',
      layout: 'grid',
      slots: [
        { id: 'revenue', label: 'Revenue', factKeys: ['revenue'], format: 'currency' },
        { id: 'profit', label: 'Net Income', factKeys: ['net profit'], format: 'currency' },
        { id: 'cap', label: 'Market Cap', factKeys: ['market capitalization'], format: 'currency' },
        { id: 'employees', label: 'Employees', factKeys: ['employees'] },
        { id: 'ticker', label: 'Ticker', factKeys: ['ticker symbol', 'stock exchange'] },
      ],
      aiPrompt: 'Explain the company financial scale in plain language using the figures provided.',
    },
    {
      id: 'leadership',
      title: 'Leadership',
      layout: 'people',
      slots: [{ id: 'ceo', label: 'CEO', factKeys: ['chief executive officer', 'CEO'] }],
      aiPrompt: 'Describe current leadership and governance in one sentence.',
    },
    {
      id: 'products',
      title: 'Business Segments',
      subtitle: 'Products & brands',
      layout: 'grid',
      slots: [
        { id: 'products', label: 'Products', factKeys: ['product or material produced', 'owner of'], format: 'list' },
      ],
      aiPrompt: 'Describe the main product lines and business segments.',
    },
    {
      id: 'history',
      title: 'Company History',
      subtitle: 'Timeline of founding, leadership, and major milestones',
      layout: 'timeline',
      slots: [
        { id: 'founded', label: 'Founded', factKeys: ['inception', 'founded'], format: 'date' },
        { id: 'milestones', label: 'Milestones', factKeys: ['company milestone', 'significant event'], format: 'list' },
        { id: 'founders', label: 'Founded by', factKeys: ['founded by'], format: 'list' },
      ],
      aiPrompt: 'Narrate the company history as a short chronological story.',
    },
    {
      id: 'honours',
      title: 'Honours',
      layout: 'awards',
      slots: [{ id: 'awards', label: 'Awards', factKeys: ['award received'], format: 'list' }],
      aiPrompt: 'Highlight notable awards and recognition.',
    },
  ],
}

const WORK_TEMPLATE: CategoryTemplate = {
  id: 'work-film',
  kind: 'work',
  label: 'Film & Media',
  heroTone: 'crimson',
  sections: [
    {
      id: 'summary',
      title: 'AI Summary',
      subtitle: 'Powered by cross-verified sources',
      layout: 'narrative',
      slots: [],
      aiPrompt:
        'Write an engaging 2–3 sentence overview of this film: genre, release, director, cast, and cultural significance. Use only provided facts.',
    },
    {
      id: 'identity',
      title: 'At a Glance',
      layout: 'highlights',
      slots: [
        { id: 'released', label: 'Released', factKeys: ['publication date', 'release date'], format: 'date' },
        { id: 'genre', label: 'Genre', factKeys: ['genre'], format: 'list' },
        { id: 'country', label: 'Country', factKeys: ['country of origin'] },
        { id: 'language', label: 'Language', factKeys: ['original language'] },
      ],
      aiPrompt: 'Capture the film identity in one vivid sentence.',
    },
    {
      id: 'creative',
      title: 'Film Details',
      subtitle: 'Facts matched across Wikidata, Wikipedia, and DBpedia',
      layout: 'grid',
      slots: [
        { id: 'director', label: 'Director', factKeys: ['director'] },
        { id: 'producer', label: 'Producer', factKeys: ['producer'] },
        { id: 'writer', label: 'Writer', factKeys: ['screenwriter'] },
        { id: 'music', label: 'Music', factKeys: ['composer'] },
        { id: 'studio', label: 'Studio', factKeys: ['production company'] },
        { id: 'runtime', label: 'Runtime', factKeys: ['duration'] },
        { id: 'budget', label: 'Budget', factKeys: ['production budget', 'budget'], format: 'currency' },
        { id: 'boxoffice', label: 'Box Office', factKeys: ['box office'], format: 'currency' },
        { id: 'rating', label: 'Rating', factKeys: ['review score', 'IMDb Rating'], format: 'rating' },
      ],
      aiPrompt: 'Describe the creative team and production in one sentence.',
    },
    {
      id: 'cast',
      title: 'Cast',
      layout: 'cast',
      slots: [{ id: 'cast', label: 'Cast', factKeys: ['cast member'], format: 'list' }],
      aiPrompt: 'Introduce the principal cast in one sentence.',
    },
    {
      id: 'reception',
      title: 'Awards & Recognition',
      layout: 'awards',
      slots: [{ id: 'awards', label: 'Awards', factKeys: ['award received'], format: 'list' }],
      aiPrompt: 'Summarize critical reception and awards.',
    },
    {
      id: 'timeline',
      title: 'Timeline',
      layout: 'timeline',
      slots: [
        { id: 'released', label: 'Release', factKeys: ['publication date', 'release date'], format: 'date' },
      ],
      aiPrompt: 'Note key dates in the film lifecycle.',
    },
  ],
}

const PERSON_TEMPLATE: CategoryTemplate = {
  id: 'person-profile',
  kind: 'person',
  label: 'Person',
  heroTone: 'blue',
  sections: [
    {
      id: 'summary',
      title: 'AI Summary',
      subtitle: 'Powered by cross-verified sources',
      layout: 'narrative',
      slots: [],
      aiPrompt:
        'Write a compelling 2–3 sentence biography: profession, origins, career highlights, and legacy. Use only provided facts.',
    },
    {
      id: 'identity',
      title: 'At a Glance',
      layout: 'highlights',
      slots: [
        { id: 'occupation', label: 'Profession', factKeys: ['occupation'], format: 'list' },
        { id: 'born', label: 'Born', factKeys: ['date of birth'], format: 'date' },
        { id: 'birthplace', label: 'Birthplace', factKeys: ['place of birth'] },
        { id: 'nationality', label: 'Nationality', factKeys: ['country of citizenship'] },
        { id: 'languages', label: 'Languages', factKeys: ['languages spoken', 'native language'], format: 'list' },
      ],
      aiPrompt: 'Introduce this person in one memorable sentence.',
    },
    {
      id: 'personal',
      title: 'Personal Details',
      subtitle: 'Facts matched across Wikidata, Wikipedia, and DBpedia',
      layout: 'grid',
      slots: [
        { id: 'born', label: 'Born', factKeys: ['date of birth'], format: 'date' },
        { id: 'birthplace', label: 'Birthplace', factKeys: ['place of birth'] },
        { id: 'nationality', label: 'Nationality', factKeys: ['country of citizenship'] },
        { id: 'occupation', label: 'Occupation', factKeys: ['occupation'], format: 'list' },
        { id: 'education', label: 'Education', factKeys: ['educated at'], format: 'list' },
        { id: 'spouse', label: 'Spouse', factKeys: ['spouse', 'unmarried partner'] },
        { id: 'awards', label: 'Awards', factKeys: ['award received'], format: 'list' },
      ],
      aiPrompt: 'Summarize personal background and credentials.',
    },
    {
      id: 'career',
      title: 'Career Phases',
      layout: 'timeline',
      slots: [
        { id: 'occupation', label: 'Occupation', factKeys: ['occupation'], format: 'list' },
        { id: 'employer', label: 'Employer', factKeys: ['employer'], format: 'list' },
        { id: 'works', label: 'Notable Work', factKeys: ['notable work'], format: 'list' },
      ],
      aiPrompt: 'Outline career trajectory in one paragraph.',
    },
    {
      id: 'works',
      title: 'Popular Films',
      subtitle: 'Notable works from linked sources',
      layout: 'films',
      slots: [{ id: 'notable', label: 'Notable Work', factKeys: ['notable work'], format: 'list' }],
      aiPrompt: 'Highlight signature works and their impact.',
    },
    {
      id: 'honours',
      title: 'Top Honours',
      layout: 'awards',
      slots: [{ id: 'awards', label: 'Awards', factKeys: ['award received'], format: 'list' }],
      aiPrompt: 'Celebrate major honours received.',
    },
    {
      id: 'family',
      title: 'Family',
      layout: 'people',
      slots: [
        { id: 'spouse', label: 'Spouse', factKeys: ['spouse', 'unmarried partner'] },
        { id: 'children', label: 'Children', factKeys: ['child'], format: 'list' },
        { id: 'parents', label: 'Parents', factKeys: ['father', 'mother'], format: 'list' },
      ],
      aiPrompt: 'Note key family relationships briefly.',
    },
  ],
}

export const CATEGORY_TEMPLATES: Record<EntityKind, CategoryTemplate | undefined> = {
  person: PERSON_TEMPLATE,
  org: ORG_TEMPLATE,
  work: WORK_TEMPLATE,
  place: undefined,
  other: undefined,
}

export function templateForKind(kind: EntityKind): CategoryTemplate | undefined {
  return CATEGORY_TEMPLATES[kind]
}
