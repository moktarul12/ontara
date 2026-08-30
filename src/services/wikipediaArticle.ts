import { htmlToParagraphs, htmlToPlainText, htmlToExternalLinks } from '../utils/htmlToText'
import { editorializeWikiParagraph, editorializeWikiParagraphs } from '../utils/editorializeWiki'
import { normalizeSectionParagraphs } from '../utils/sectionParagraphs'

export type WikipediaSitelink = {
  title: string
  lang: string
  url: string
}

export type WikipediaSectionRaw = {
  id: number
  title: string
  level: 2 | 3 | 4
  paragraphs: string[]
  anchor: string
}

export type WikipediaArticleRaw = {
  title: string
  lang: string
  url: string
  description?: string
  leadText: string
  leadImage?: string
  sections: WikipediaSectionRaw[]
}

function qidFromUri(uri: string): string | null {
  const m = uri.match(/\/(Q\d+)$/i) || uri.match(/(Q\d+)/i)
  return m ? m[1].toUpperCase() : null
}

function wikiSiteKey(lang: string): string {
  return `${lang}wiki`
}

function wikiBaseUrl(lang: string): string {
  return `https://${lang}.wikipedia.org`
}

function mediaWikiApi(lang: string, params: Record<string, string>): string {
  const q = new URLSearchParams({ format: 'json', origin: '*', ...params })
  return `/api/mediawiki/${lang}?${q.toString()}`
}

async function fetchJson<T>(url: string, timeoutMs = 18000): Promise<T | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Resolve Wikipedia article title from Wikidata Q-id and language. */
export async function fetchWikipediaSitelink(
  entityUri: string,
  lang: string,
): Promise<WikipediaSitelink | null> {
  const qid = qidFromUri(entityUri)
  if (!qid) return null

  const data = await fetchJson<{
    entities?: Record<string, { sitelinks?: Record<string, { title: string }> }>
  }>(`/api/wikidata?action=wbgetentities&ids=${qid}&props=sitelinks&format=json`)

  const site = data?.entities?.[qid]?.sitelinks?.[wikiSiteKey(lang)]
  if (!site?.title) {
    if (lang !== 'en') return fetchWikipediaSitelink(entityUri, 'en')
    return null
  }

  const title = site.title
  return {
    title,
    lang,
    url: `${wikiBaseUrl(lang)}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
  }
}

type SummaryResponse = {
  title?: string
  description?: string
  extract?: string
  thumbnail?: { source?: string }
  content_urls?: { desktop?: { page?: string } }
}

type MwSection = {
  toclevel: number
  level: string
  line: string
  index: string
  anchor: string
}

type MwParseSections = {
  parse?: {
    title?: string
    pageid?: number
    sections?: MwSection[]
  }
}

type MwParseText = {
  parse?: {
    text?: string
  }
}

const SKIP_SECTIONS =
  /^(references|external links|see also|notes|further reading|bibliography|sources|footnotes|citations)$/i

function headingLevel(section: MwSection): 2 | 3 | 4 {
  const lv = parseInt(section.level, 10)
  if (lv <= 2) return 2
  if (lv === 3) return 3
  return 4
}

async function fetchSectionParagraphs(
  lang: string,
  page: string,
  sectionIndex: string,
): Promise<string[]> {
  const data = await fetchJson<MwParseText>(
    mediaWikiApi(lang, {
      action: 'parse',
      page,
      section: sectionIndex,
      prop: 'text',
      formatversion: '2',
    }),
    12000,
  )
  const html = data?.parse?.text ?? ''
  return normalizeSectionParagraphs(editorializeWikiParagraphs(htmlToParagraphs(html)))
}

export type FetchWikipediaOptions = {
  includeSections?: boolean
}

/** Fast path: Wikipedia REST summary only (no section bodies). */
export async function fetchWikipediaLead(
  title: string,
  lang: string,
): Promise<Omit<WikipediaArticleRaw, 'sections'> | null> {
  const encoded = encodeURIComponent(title.replace(/ /g, '_'))
  const summary = await fetchJson<SummaryResponse>(`/api/wikipedia/${lang}/page/summary/${encoded}`)

  if (!summary?.title) {
    if (lang !== 'en') return fetchWikipediaLead(title, 'en')
    return null
  }

  const pageTitle = summary.title
  const url =
    summary.content_urls?.desktop?.page ??
    `${wikiBaseUrl(lang)}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`

  let leadText = summary.extract?.trim() ?? ''
  if (!leadText) {
    const intro = await fetchJson<MwParseText>(
      mediaWikiApi(lang, {
        action: 'parse',
        page: pageTitle,
        section: '0',
        prop: 'text',
        formatversion: '2',
      }),
    )
    leadText = htmlToPlainText(intro?.parse?.text ?? '')
  } else {
    leadText = htmlToPlainText(`<p>${leadText}</p>`)
  }
  leadText = editorializeWikiParagraph(leadText)

  return {
    title: pageTitle,
    lang,
    url,
    description: summary.description,
    leadText,
    leadImage: summary.thumbnail?.source,
  }
}

/** Fetch Wikipedia lead + sections via MediaWiki API (mobile-sections often 403). */
export async function fetchWikipediaArticle(
  title: string,
  lang: string,
  options: FetchWikipediaOptions = {},
): Promise<WikipediaArticleRaw | null> {
  const { includeSections = true } = options
  const lead = await fetchWikipediaLead(title, lang)
  if (!lead) return null

  if (!includeSections) {
    return { ...lead, sections: [] }
  }

  const pageTitle = lead.title
  const sectionsData = await fetchJson<MwParseSections>(
    mediaWikiApi(lang, {
      action: 'parse',
      page: pageTitle,
      prop: 'sections',
    }),
  )

  const mwSections = (sectionsData?.parse?.sections ?? []).filter(
    (s) => s.line && !SKIP_SECTIONS.test(s.line.trim()),
  )

  // Fetch section bodies in small parallel batches
  const sections: WikipediaSectionRaw[] = []
  const batchSize = 6

  for (let i = 0; i < mwSections.length; i += batchSize) {
    const batch = mwSections.slice(i, i + batchSize)
    const results = await Promise.all(
      batch.map(async (s) => {
        const paragraphs = await fetchSectionParagraphs(lang, pageTitle, s.index)
        return { section: s, paragraphs }
      }),
    )
    for (const { section: s, paragraphs } of results) {
      if (!paragraphs.length) continue
      sections.push({
        id: parseInt(s.index, 10),
        title: s.line.trim(),
        level: headingLevel(s),
        paragraphs,
        anchor: s.anchor,
      })
    }
  }

  return {
    ...lead,
    sections,
  }
}

type MwCategories = {
  query?: {
    pages?: Record<string, { categories?: { title: string }[] }>
  }
}

/** Fetch External links + References link lists from Wikipedia. */
export async function fetchWikipediaSupplement(
  title: string,
  lang: string,
): Promise<{ externalLinks: { label: string; url: string }[]; categories: string[] }> {
  const sectionsData = await fetchJson<MwParseSections>(
    mediaWikiApi(lang, {
      action: 'parse',
      page: title,
      prop: 'sections',
    }),
  )

  const mwSections = sectionsData?.parse?.sections ?? []
  const externalLinks: { label: string; url: string }[] = []

  for (const pattern of [/external links/i, /^references$/i, /^notes$/i]) {
    const hit = mwSections.find((s) => pattern.test(s.line.trim()))
    if (!hit) continue
    const data = await fetchJson<MwParseText>(
      mediaWikiApi(lang, {
        action: 'parse',
        page: title,
        section: hit.index,
        prop: 'text',
        formatversion: '2',
      }),
      12000,
    )
    externalLinks.push(...htmlToExternalLinks(data?.parse?.text ?? ''))
  }

  const catData = await fetchJson<MwCategories>(
    mediaWikiApi(lang, {
      action: 'query',
      titles: title,
      prop: 'categories',
      cllimit: '20',
      formatversion: '2',
    }),
  )

  const pages = catData?.query?.pages
  const page = pages ? Object.values(pages)[0] : undefined
  const categories =
    page?.categories?.map((c) => c.title.replace(/^Category:/i, '').trim()).filter(Boolean) ?? []

  const deduped = externalLinks.filter(
    (l, i, arr) => arr.findIndex((x) => x.url === l.url) === i,
  )

  return { externalLinks: deduped.slice(0, 40), categories: categories.slice(0, 15) }
}

export { qidFromUri }
