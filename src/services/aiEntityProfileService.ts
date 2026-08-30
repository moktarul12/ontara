import type { AiEntityProfile, AiEntityProfileRequest, AiEntityProfileResponse } from '../types/aiEntityProfile'
import type { EntityDossier } from '../types/entityDossier'
import type { ArticleSection } from '../types/entityArticle'
import { applyAiEntityProfile } from './applyAiEntityProfile'

function qidFromDossier(dossier: EntityDossier): string | undefined {
  if (dossier.qid) return dossier.qid.toUpperCase()
  const m = dossier.uri.match(/\/(Q\d+)$/i)
  return m ? m[1].toUpperCase() : undefined
}

function flattenWikiSections(sections: ArticleSection[]): { id: string; title: string; excerpt?: string }[] {
  const out: { id: string; title: string; excerpt?: string }[] = []
  const walk = (list: ArticleSection[]) => {
    for (const s of list) {
      if (s.level === 2) {
        out.push({
          id: s.id,
          title: s.title,
          excerpt: s.paragraphs?.[0],
        })
      }
      walk(s.children)
    }
  }
  walk(sections)
  return out
}

function buildRequest(dossier: EntityDossier, force = false): AiEntityProfileRequest | undefined {
  const qid = qidFromDossier(dossier)
  if (!qid) return undefined
  return {
    qid,
    label: dossier.label,
    kind: dossier.kind,
    lang: dossier.language,
    wikiLead: dossier.wikipedia?.leadText ?? dossier.summary.about,
    facts: dossier.summary.verifiedFacts.slice(0, 40).map((f) => ({
      label: f.label,
      value: f.value,
    })),
    wikiSections: flattenWikiSections(dossier.wikipedia?.sections ?? []),
    force,
  }
}

async function fetchCached(qid: string): Promise<AiEntityProfile | null> {
  try {
    const res = await fetch(`/api/ai/entity/${qid}`)
    if (res.status === 404) return null
    if (!res.ok) return null
    const data = (await res.json()) as AiEntityProfileResponse
    return data
  } catch {
    return null
  }
}

async function generateProfile(req: AiEntityProfileRequest): Promise<AiEntityProfile | null> {
  try {
    const res = await fetch(`/api/ai/entity/${req.qid}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) return null
    return (await res.json()) as AiEntityProfile
  } catch {
    return null
  }
}

/**
 * Load AI profile from data/ai-cache/Q{id}.json (via API) or generate via OpenAI once, then cache.
 */
export async function enrichDossierWithAiProfile(
  dossier: EntityDossier,
  opts: { force?: boolean } = {},
): Promise<EntityDossier> {
  const req = buildRequest(dossier, opts.force)
  if (!req) return dossier

  let profile: AiEntityProfile | null = null

  if (!opts.force) {
    profile = await fetchCached(req.qid)
  }

  if (!profile) {
    profile = await generateProfile(req)
  }

  if (!profile) return dossier
  return applyAiEntityProfile(dossier, profile)
}
