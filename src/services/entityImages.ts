import { WIKIDATA_ENDPOINT } from '../types/ontology'
import { qidFromUri } from './wikidataClaims'
import * as wd from './wikidata'

const WIKIDATA_API = '/api/wikidata'
const P18 = 'P18'

type WbEntity = {
  claims?: Record<string, { mainsnak: { datavalue?: { value: string | { id?: string } } } }[]>
}

function commonsFromClaim(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return null
  return null
}

/** Fetch P18 image via Wikidata API (fallback when SPARQL image is slow). */
export async function fetchWikidataP18Image(
  entityUri: string,
  width = 480,
): Promise<string | null> {
  const qid = qidFromUri(entityUri)
  if (!qid) return null
  try {
    const res = await fetch(
      `${WIKIDATA_API}?action=wbgetentities&ids=${qid}&props=claims&format=json`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { entities?: Record<string, WbEntity> }
    const claims = data.entities?.[qid]?.claims?.[P18]
    const file = claims?.[0]?.mainsnak?.datavalue?.value
    const name = commonsFromClaim(file)
    if (!name) return null
    return wd.resolveCommonsThumb(`http://commons.wikimedia.org/wiki/Special:FilePath/${name}`, width)
  } catch {
    return null
  }
}

function normalizeUri(uri: string): string {
  const m = uri.match(/^(Q\d+)$/i)
  if (m) return `http://www.wikidata.org/entity/${m[1].toUpperCase()}`
  return uri.trim()
}

/** Batch-fetch portrait/poster images for linked entities. */
export async function fetchEntityImagesBatch(
  uris: string[],
  width = 280,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  const unique = [...new Set(uris.map(normalizeUri).filter(Boolean))]
  const qids = unique.map((u) => qidFromUri(u)).filter((q): q is string => Boolean(q))
  if (!qids.length) return out

  for (let i = 0; i < qids.length; i += 40) {
    const chunk = qids.slice(i, i + 40)
    try {
      const res = await fetch(
        `${WIKIDATA_API}?action=wbgetentities&ids=${chunk.join('|')}&props=claims&format=json`,
      )
      if (!res.ok) continue
      const data = (await res.json()) as { entities?: Record<string, WbEntity> }
      await Promise.all(
        chunk.map(async (qid) => {
          const uri = `http://www.wikidata.org/entity/${qid}`
          const claims = data.entities?.[qid]?.claims?.[P18]
          const file = claims?.[0]?.mainsnak?.datavalue?.value
          const name = commonsFromClaim(file)
          if (!name) {
            const sparql = await wd.wdEntityImage(WIKIDATA_ENDPOINT, uri, width)
            if (sparql) out[uri] = sparql
            return
          }
          const thumb = await wd.resolveCommonsThumb(
            `http://commons.wikimedia.org/wiki/Special:FilePath/${name}`,
            width,
          )
          if (thumb) out[uri] = thumb
        }),
      )
    } catch {
      /* skip chunk */
    }
  }
  return out
}

export function upscaleWikiThumb(url: string | undefined, width = 480): string | undefined {
  if (!url) return undefined
  return url.replace(/\/(\d+)px-/, `/${width}px-`)
}
