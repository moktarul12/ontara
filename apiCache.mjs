import { createHash } from 'node:crypto'

const STALE_KEEP_MS = 24 * 60 * 60 * 1000

/** @type {Map<string, { body: Buffer, status: number, contentType: string | null, storedAt: number, ttlMs: number, staleUntil: number }>} */
const entries = new Map()

/** @type {Map<string, Promise<{ body: Buffer, status: number, contentType: string | null, cacheHit: string }>>} */
const inflight = new Map()

/** Limit concurrent upstream SPARQL — avoids Wikidata 429 storms. */
let sparqlActive = 0
const sparqlWaiters = []
const SPARQL_MAX = Number(process.env.SPARQL_MAX_CONCURRENT) || 3

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function acquireSparqlSlot() {
  if (sparqlActive < SPARQL_MAX) {
    sparqlActive += 1
    return
  }
  await new Promise((resolve) => sparqlWaiters.push(resolve))
  sparqlActive += 1
}

function releaseSparqlSlot() {
  sparqlActive -= 1
  const next = sparqlWaiters.shift()
  if (next) next()
}

function hashKey(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

function readEntry(key, allowStale) {
  const hit = entries.get(key)
  if (!hit) return null
  const age = Date.now() - hit.storedAt
  if (age <= hit.ttlMs) return { ...hit, cacheHit: 'HIT' }
  if (allowStale && Date.now() <= hit.staleUntil) return { ...hit, cacheHit: 'STALE' }
  entries.delete(key)
  return null
}

function storeEntry(key, { body, status, contentType }, ttlMs) {
  const now = Date.now()
  entries.set(key, {
    body,
    status,
    contentType,
    storedAt: now,
    ttlMs,
    staleUntil: now + STALE_KEEP_MS,
  })
}

/**
 * Cached upstream fetch with in-flight dedupe and optional stale fallback.
 * @param {string} cacheKey
 * @param {number} ttlMs
 * @param {() => Promise<{ ok: boolean, status: number, headers: Headers, arrayBuffer: () => Promise<ArrayBuffer> }>} upstream
 * @param {{ isSparql?: boolean, allowStaleOnError?: boolean }} opts
 */
export async function cachedUpstream(cacheKey, ttlMs, upstream, opts = {}) {
  const { isSparql = false, allowStaleOnError = true } = opts

  const fresh = readEntry(cacheKey, false)
  if (fresh) return fresh

  const stale = readEntry(cacheKey, true)

  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)
  }

  const run = (async () => {
    const exec = async () => {
      if (isSparql) await acquireSparqlSlot()
      try {
        let lastRes = null
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const res = await upstream()
          lastRes = res
          if (res.status === 429 || res.status === 503) {
            const retryAfter = Number(res.headers.get('retry-after')) || 0
            const wait = retryAfter > 0 ? retryAfter * 1000 : Math.min(1500 * (attempt + 1), 8000)
            await sleep(wait)
            continue
          }
          break
        }
        if (!lastRes) throw new Error('Upstream returned no response')

        const body = Buffer.from(await lastRes.arrayBuffer())
        const contentType = lastRes.headers.get('content-type')
        const pack = { body, status: lastRes.status, contentType }

        if (lastRes.ok) {
          storeEntry(cacheKey, pack, ttlMs)
          return { ...pack, cacheHit: 'MISS' }
        }

        if (allowStaleOnError && stale) {
          return { body: stale.body, status: stale.status, contentType: stale.contentType, cacheHit: 'STALE' }
        }

        return { ...pack, cacheHit: 'MISS' }
      } finally {
        if (isSparql) releaseSparqlSlot()
      }
    }

    try {
      return await exec()
    } catch (err) {
      if (allowStaleOnError && stale) {
        return {
          body: stale.body,
          status: stale.status,
          contentType: stale.contentType,
          cacheHit: 'STALE',
        }
      }
      throw err
    }
  })()

  inflight.set(cacheKey, run)
  try {
    return await run
  } finally {
    inflight.delete(cacheKey)
  }
}

export function cacheKeyFromUrl(url) {
  return hashKey(url.toString())
}

export function cacheKeyFromSparql(method, url, body) {
  const query =
    method === 'POST' && body
      ? new URLSearchParams(body.toString()).get('query') ?? body.toString()
      : url.searchParams.get('query') ?? url.toString()
  return `sparql:${hashKey(query)}`
}

export function cacheStats() {
  return { entries: entries.size, inflight: inflight.size, sparqlActive, sparqlMax: SPARQL_MAX }
}

/** TTL presets (ms) */
export const TTL = {
  wikidata: 15 * 60 * 1000,
  wikipedia: 30 * 60 * 1000,
  mediawiki: 30 * 60 * 1000,
  sparql: 20 * 60 * 1000,
}
