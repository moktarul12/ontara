/**
 * Full creative entity profiles via OpenAI — cached per Q-id (e.g. data/ai-cache/Q9570.json).
 */

import { readEntityCache, writeEntityCache } from './aiEntityCache.mjs'

function factMap(facts) {
  const m = new Map()
  for (const f of facts ?? []) {
    const key = String(f.label ?? '').toLowerCase()
    if (!key) continue
    if (!m.has(key)) m.set(key, [])
    m.get(key).push(f.value)
  }
  return m
}

function pick(facts, ...labels) {
  const m = factMap(facts)
  for (const l of labels) {
    const v = m.get(l.toLowerCase())
    if (v?.length) return v[0]
  }
  return undefined
}

function templateProfile(body) {
  const { qid, label, kind, lang, wikiLead, facts = [], wikiSections = [] } = body
  const born = pick(facts, 'date of birth')
  const year = born?.match(/\d{4}/)?.[0]

  const thirtySecond =
    kind === 'person'
      ? `${label} is ${pick(facts, 'occupation') ?? 'a notable figure'} from ${pick(facts, 'country of citizenship') ?? 'India'}.${born ? ` Born ${born}.` : ''}`
      : `${label} — synthesized from verified reference data.`

  const timeline = []
  if (year) timeline.push({ year, label: 'Origins', detail: `${label} enters the historical record around ${year}.` })
  for (const s of wikiSections.slice(0, 6)) {
    timeline.push({
      label: s.title,
      detail: s.excerpt?.slice(0, 120) ?? `A defining chapter: ${s.title}.`,
    })
  }

  const chapters = wikiSections.map((s) => ({
    id: s.id,
    title: s.title,
    lead: s.excerpt?.slice(0, 220) ?? `${s.title} — key developments in the story of ${label}.`,
    paragraphs: s.excerpt ? [s.excerpt] : [`Overview of ${s.title} for ${label}.`],
  }))

  if (wikiLead && !chapters.some((c) => c.id === 'introduction')) {
    chapters.unshift({
      id: 'introduction',
      title: 'Introduction',
      lead: wikiLead.slice(0, 280),
      paragraphs: wikiLead.split(/\n+/).filter(Boolean).slice(0, 3),
    })
  }

  return {
    qid,
    label,
    kind,
    lang,
    source: 'template',
    generatedAt: new Date().toISOString(),
    cacheVersion: 1,
    summary: {
      hook: thirtySecond,
      thirtySecond,
      narrative: wikiLead ?? thirtySecond,
    },
    timeline,
    history: {
      narrative: wikiLead ?? `The story of ${label} spans decades of documented milestones.`,
      eras: wikiSections.slice(0, 4).map((s, i) => ({
        era: s.title.match(/\d{4}/)?.[0] ?? `${1970 + i * 10}s`,
        title: s.title,
        description: s.excerpt?.slice(0, 160) ?? s.title,
      })),
    },
    chapters,
    highlights: facts.slice(0, 6).map((f) => ({ label: f.label, detail: f.value })),
  }
}

async function buildEntityPrompt(body) {
  const { label, kind, facts, wikiLead, wikiSections = [] } = body

  const factLines = (facts ?? [])
    .slice(0, 40)
    .map((f) => `- ${f.label}: ${f.value}`)
    .join('\n')

  const sectionLines = wikiSections
    .slice(0, 14)
    .map((s) => `• ${s.title} (${s.id})${s.excerpt ? `: ${s.excerpt.slice(0, 200)}` : ''}`)
    .join('\n')

  const system = `You are a world-class encyclopedia editor at a premium knowledge platform (think Wikipedia meets The Economist).
Write vivid, original prose — never copy source text verbatim. Use ONLY facts provided; do not invent dates, awards, or relationships.
Be creative with language, structure, and narrative flow while staying factual.

Return valid JSON matching this schema:
{
  "summary": {
    "hook": "one gripping opening sentence",
    "thirtySecond": "2-3 sentence overview readable in 30 seconds",
    "narrative": "4-6 sentence rich editorial portrait"
  },
  "timeline": [
    { "year": "1942", "label": "Short title", "detail": "2-3 vivid sentences about this milestone", "era": "optional era label" }
  ],
  "history": {
    "narrative": "2-4 paragraph history arc with creative but factual prose",
    "eras": [{ "era": "1970s", "title": "Phase name", "description": "1-2 sentences" }]
  },
  "chapters": [
    {
      "id": "section-slug",
      "title": "Section Title",
      "lead": "compelling opening paragraph",
      "paragraphs": ["paragraph 2", "paragraph 3"],
      "subsections": [{ "title": "Sub", "paragraphs": ["..."] }]
    }
  ],
  "highlights": [{ "label": "Fact name", "detail": "Memorable phrasing" }]
}

Requirements:
- timeline: 10-16 events for persons, 8-12 for orgs/works — fill gaps creatively from context but no fiction
- chapters: one per wiki section provided, 2-4 paragraphs each, fully rewritten
- Include an "introduction" chapter (id: "introduction") when wiki lead is provided`

  const user = `Entity: ${label}
Kind: ${kind}
Language: ${body.lang ?? 'en'}

Wikipedia lead (paraphrase entirely):
${wikiLead?.slice(0, 900) ?? '(none)'}

Verified facts:
${factLines || '(none)'}

Wikipedia sections to rewrite as chapters:
${sectionLines || '(none)'}`

  return { system, user }
}

function profileFromParsed(body, parsed) {
  return {
    qid: body.qid,
    label: body.label,
    kind: body.kind,
    lang: body.lang ?? 'en',
    source: 'llm',
    generatedAt: new Date().toISOString(),
    cacheVersion: 1,
    summary: {
      hook: parsed.summary?.hook ?? '',
      thirtySecond: parsed.summary?.thirtySecond ?? parsed.summary?.hook ?? '',
      narrative: parsed.summary?.narrative ?? parsed.summary?.thirtySecond ?? '',
    },
    timeline: Array.isArray(parsed.timeline) ? parsed.timeline : [],
    history: {
      narrative: parsed.history?.narrative ?? '',
      eras: parsed.history?.eras ?? [],
    },
    chapters: Array.isArray(parsed.chapters) ? parsed.chapters : [],
    highlights: parsed.highlights ?? [],
  }
}

async function callOpenAI(body, apiKey) {
  const { system, user } = await buildEntityPrompt(body)

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.65,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('Empty OpenAI response')

  return profileFromParsed(body, JSON.parse(raw))
}

async function callGemini(body, apiKey) {
  const { system, user } = await buildEntityPrompt(body)
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash'

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: {
          temperature: 0.65,
          responseMimeType: 'application/json',
        },
      }),
    },
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!raw) throw new Error('Empty Gemini response')

  return profileFromParsed(body, JSON.parse(raw))
}

async function callAnyLlm(body) {
  const errors = []

  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(body, process.env.OPENAI_API_KEY)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      console.warn('[ai/entity] OpenAI failed:', msg)
    }
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGemini(body, process.env.GEMINI_API_KEY)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      console.warn('[ai/entity] Gemini failed:', msg)
    }
  }

  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error('No LLM API key configured (set OPENAI_API_KEY or GEMINI_API_KEY)')
  }

  throw new Error(errors.join(' | ') || 'All LLM providers failed')
}

/** @param {import('./aiEntityProfile.types').AiEntityProfileRequest} body */
export async function handleAiEntityProfile(body) {
  const qid = String(body.qid ?? '')
    .toUpperCase()
    .replace(/^.*?(Q\d+).*$/i, '$1')
  if (!/^Q\d+$/.test(qid)) {
    throw new Error('Valid qid required')
  }

  if (!body.force) {
    const cached = await readEntityCache(qid)
    if (cached?.cacheVersion === 1 && cached.label === body.label) {
      return { ...cached, source: 'cache', fromCache: true }
    }
  }

  const hasLlmKey = Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)
  let profile
  let generationError

  if (hasLlmKey) {
    try {
      profile = await callAnyLlm({ ...body, qid })
    } catch (err) {
      generationError = err instanceof Error ? err.message : String(err)
      console.warn('[ai/entity] LLM failed, using template fallback:', generationError)
      const existing = await readEntityCache(qid)
      if (existing?.source === 'llm' && !body.force) {
        return { ...existing, source: 'cache', fromCache: true, generationError }
      }
      profile = templateProfile({ ...body, qid })
      profile.source = 'template'
      profile.generationError = generationError
    }
  } else {
    profile = templateProfile({ ...body, qid })
    profile.generationError = 'Set OPENAI_API_KEY or GEMINI_API_KEY in .env'
  }

  const file = await writeEntityCache(qid, profile)
  console.log(`[ai/entity] Saved ${qid} (${profile.source}) → ${file}`)
  return { ...profile, fromCache: false, generationError: profile.generationError }
}

/** @param {string} qid */
export async function getCachedEntityProfile(qid) {
  const id = String(qid)
    .toUpperCase()
    .replace(/^.*?(Q\d+).*$/i, '$1')
  const cached = await readEntityCache(id)
  if (!cached) return null
  return { ...cached, source: 'cache', fromCache: true }
}
