import type { CategoryContent, FilledSection } from '../types/entityTemplate'
import type { EntityDossier, VerifiedFact } from '../types/entityDossier'
import type { EntityKind } from '../types/entityArticle'
import { buildCategoryContent, buildFallbackCategoryContent } from './entityTemplateEngine'
import { templateForKind } from '../types/entityTemplate'

const CACHE = new Map<string, CategoryContent & { _at?: number }>()
const CACHE_MS = 10 * 60 * 1000

type AiSynthesizeRequest = {
  label: string
  kind: EntityKind
  templateId: string
  wikiLead?: string
  facts: { label: string; value: string }[]
  sections: { id: string; title: string; prompt: string; slots: { label: string; value: string }[] }[]
}

type AiSynthesizeResponse = {
  source: 'template' | 'llm' | 'hybrid'
  summaryNarrative?: string
  sections?: { id: string; narrative?: string }[]
}

function cacheKey(label: string, kind: EntityKind, facts: VerifiedFact[]): string {
  const sig = facts
    .slice(0, 12)
    .map((f) => `${f.label}:${f.value}`)
    .join('|')
  return `${kind}|${label}|${sig}`
}

async function fetchLlmContent(req: AiSynthesizeRequest): Promise<AiSynthesizeResponse | null> {
  try {
    const res = await fetch('/api/ai/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) return null
    return (await res.json()) as AiSynthesizeResponse
  } catch {
    return null
  }
}

function mergeLlm(base: CategoryContent, llm: AiSynthesizeResponse): CategoryContent {
  const sectionMap = new Map(llm.sections?.map((s) => [s.id, s.narrative]) ?? [])
  const sections: FilledSection[] = base.sections.map((s) => {
    const ai = sectionMap.get(s.id)
    if (!ai) return s
    return { ...s, narrative: ai, source: 'hybrid' as const }
  })
  return {
    ...base,
    summaryNarrative: llm.summaryNarrative ?? base.summaryNarrative,
    sections,
    source: llm.summaryNarrative || llm.sections?.length ? 'hybrid' : base.source,
  }
}

/** Build category template content; optionally enrich via LLM when API key is configured. */
export async function buildAiCategoryContent(
  dossier: EntityDossier,
  facts: VerifiedFact[],
): Promise<CategoryContent | undefined> {
  const key = cacheKey(dossier.label, dossier.kind, facts)
  const hit = CACHE.get(key)
  if (hit?._at && Date.now() - hit._at < CACHE_MS) {
    return hit
  }

  const base = buildCategoryContent(dossier, facts) ?? buildFallbackCategoryContent(dossier, facts)
  if (!base) return undefined

  const template = templateForKind(dossier.kind)

  const llm = await fetchLlmContent({
    label: dossier.label,
    kind: dossier.kind,
    templateId: template?.id ?? `${dossier.kind}-fallback`,
    wikiLead: dossier.wikipedia?.leadText ?? dossier.summary.about,
    facts: facts.slice(0, 24).map((f) => ({ label: f.label, value: f.value })),
    sections: base.sections.map((s) => {
      const def = template?.sections.find((d) => d.id === s.id)
      return {
        id: s.id,
        title: s.title,
        prompt: def?.aiPrompt ?? s.title,
        slots: s.slots.map((sl) => ({ label: sl.label, value: sl.value })),
      }
    }),
  })

  const result = llm ? mergeLlm(base, llm) : base
  CACHE.set(key, { ...result, _at: Date.now() })
  return result
}
