import { isWikidataEndpoint, runSparql } from './sparql-core'

export type EntityLanguageVariant = {
  lang: string
  label: string
  description?: string
}

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const SCHEMA_DESC = 'http://schema.org/description'

/** Human-readable language name for dropdown (e.g. "hi" → "Hindi"). */
export function languageDisplayName(code: string, inLocale = 'en'): string {
  if (!code || code === 'und') return 'Unknown'
  try {
    const name = new Intl.DisplayNames([inLocale], { type: 'language' }).of(code)
    return name ? `${name} (${code})` : code
  } catch {
    return code
  }
}

function mergeVariants(
  labels: Map<string, string>,
  descriptions: Map<string, string>,
): EntityLanguageVariant[] {
  const langs = new Set([...labels.keys(), ...descriptions.keys()])
  const out: EntityLanguageVariant[] = []
  for (const lang of langs) {
    const label = labels.get(lang)
    if (!label) continue
    out.push({
      lang,
      label,
      description: descriptions.get(lang),
    })
  }
  out.sort((a, b) => {
    if (a.lang === 'en') return -1
    if (b.lang === 'en') return 1
    return languageDisplayName(a.lang).localeCompare(languageDisplayName(b.lang))
  })
  return out
}

async function wikidataLanguageVariants(
  endpoint: string,
  uri: string,
): Promise<EntityLanguageVariant[]> {
  const query = `
    SELECT ?lang ?label ?desc WHERE {
      {
        <${uri}> <${RDFS_LABEL}> ?label .
        BIND(LANG(?label) AS ?lang)
        FILTER(BOUND(?lang) && STRLEN(?lang) > 0)
      }
      OPTIONAL {
        <${uri}> <${SCHEMA_DESC}> ?desc .
        FILTER(LANG(?desc) = ?lang)
      }
    }
  `
  const rows = await runSparql(endpoint, query, 12000)
  const labels = new Map<string, string>()
  const descriptions = new Map<string, string>()

  for (const r of rows) {
    const lang = r.lang?.value?.trim()
    const label = r.label?.value?.trim()
    if (!lang || !label) continue
    if (!labels.has(lang)) labels.set(lang, label)
    const desc = r.desc?.value?.trim()
    if (desc && !descriptions.has(lang)) descriptions.set(lang, desc)
  }

  return mergeVariants(labels, descriptions)
}

/** All label + description languages available for an entity. */
export async function fetchEntityLanguageVariants(
  endpoint: string,
  uri: string,
): Promise<EntityLanguageVariant[]> {
  if (!uri) return []
  if (isWikidataEndpoint(endpoint)) {
    try {
      const variants = await wikidataLanguageVariants(endpoint, uri)
      if (variants.length) return variants
    } catch {
      /* fall through */
    }
  }
  return []
}

export function pickLanguageVariant(
  variants: EntityLanguageVariant[],
  preferred: string,
  fallbackLabel?: string,
): EntityLanguageVariant | null {
  if (!variants.length) {
    if (fallbackLabel) return { lang: preferred || 'en', label: fallbackLabel }
    return null
  }
  const pref = preferred.trim().toLowerCase()
  return (
    variants.find((v) => v.lang === pref) ||
    variants.find((v) => v.lang === 'en') ||
    variants[0]
  )
}
