import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = process.env.AI_CACHE_DIR || path.join(__dirname, 'data', 'ai-cache')

function cachePath(qid) {
  const id = String(qid).replace(/^Q/i, 'Q').toUpperCase()
  if (!/^Q\d+$/.test(id)) throw new Error(`Invalid Q-id: ${qid}`)
  return path.join(CACHE_DIR, `${id}.json`)
}

export async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

/** @returns {Promise<import('./aiEntityProfile.types').AiEntityProfile | null>} */
export async function readEntityCache(qid) {
  try {
    const raw = await fs.readFile(cachePath(qid), 'utf8')
    return JSON.parse(raw)
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') return null
    throw err
  }
}

/** @param {string} qid @param {object} profile */
export async function writeEntityCache(qid, profile) {
  await ensureCacheDir()
  const file = cachePath(qid)
  await fs.writeFile(file, `${JSON.stringify(profile, null, 2)}\n`, 'utf8')
  return file
}

export function cacheFileForQid(qid) {
  return cachePath(qid)
}
