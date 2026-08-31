import type { SparqlSourceId } from './ontology'
import type { WikipediaSectionTocEntry } from '../services/wikipediaArticle'

export type EntityKind = 'person' | 'org' | 'work' | 'place' | 'other'

export type InfoboxRow = {
  label: string
  values: { text: string; href?: string }[]
}

export type ArticleTableColumn = {
  key: string
  label: string
}

export type ArticleTable = {
  id: string
  title: string
  columns: ArticleTableColumn[]
  rows: Record<string, string>[]
}

export type ArticleSection = {
  id: string
  title: string
  level: 2 | 3 | 4
  prose?: string
  paragraphs?: string[]
  tables?: ArticleTable[]
  children: ArticleSection[]
  source?: 'wikipedia' | 'wikidata' | 'generated'
}

export type ArticleReference = {
  id: string
  label: string
  url: string
  source: SparqlSourceId | 'wikipedia'
}

export type EntityArticle = {
  uri: string
  qid?: string
  label: string
  kind: EntityKind
  language: string
  wikipediaTitle?: string
  wikipediaUrl?: string
  wikidataUrl?: string
  lead: {
    text: string
    paragraphs?: string[]
    imageUrl?: string
    source: 'wikipedia' | 'wikidata' | 'dbpedia' | 'generated'
  }
  infobox: InfoboxRow[]
  sections: ArticleSection[]
  references: ArticleReference[]
  sourcesUsed: (SparqlSourceId | 'wikipedia')[]
  externalLinks?: { label: string; url: string }[]
  categories?: string[]
  wikipediaSectionToc?: WikipediaSectionTocEntry[]
}
