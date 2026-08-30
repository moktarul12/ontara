/**
 * Shared AI synthesis for dev (Vite) and production (Express).
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise rule-based copy from facts.
 */

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

function allValues(facts, ...labels) {
  const m = factMap(facts)
  const out = []
  for (const l of labels) {
    for (const v of m.get(l.toLowerCase()) ?? []) out.push(v)
  }
  return out
}

function buildSummaryNarrative(label, kind, facts) {
  if (kind === 'org') {
    const industry = pick(facts, 'industry')
    const hq = pick(facts, 'headquarters', 'headquarters location')
    const country = pick(facts, 'country', 'country of origin')
    const founded = pick(facts, 'inception', 'founded')
    const ceo = pick(facts, 'chief executive officer', 'CEO')
    const parts = [
      `${label} is${industry ? ` a major player in ${industry.toLowerCase()}` : ' a notable organization'}${country ? `, rooted in ${country}` : ''}.`,
    ]
    if (hq) parts.push(`Its headquarters are in ${hq}.`)
    if (founded) parts.push(`The company traces its origins to ${founded}.`)
    if (ceo) parts.push(`Today it is led by ${ceo}.`)
    return parts.join(' ')
  }

  if (kind === 'work') {
    const director = pick(facts, 'director')
    const genre = allValues(facts, 'genre').slice(0, 3).join(', ')
    const released = pick(facts, 'publication date', 'release date')
    const cast = allValues(facts, 'cast member').slice(0, 3).join(', ')
    let opener = label
    if (released) opener += ` (${released})`
    opener += genre ? ` is a ${genre.toLowerCase()} film` : ' is a landmark film'
    const parts = [opener + '.']
    if (director) parts.push(`Directed by ${director}.`)
    if (cast) parts.push(`It stars ${cast}.`)
    return parts.join(' ')
  }

  if (kind === 'person') {
    const occupation = allValues(facts, 'occupation').slice(0, 2).join(' and ')
    const birthplace = pick(facts, 'place of birth')
    const nationality = pick(facts, 'country of citizenship')
    const born = pick(facts, 'date of birth')
    const parts = [
      `${label} is${occupation ? ` a renowned ${occupation.toLowerCase()}` : ' a notable public figure'}${nationality ? ` from ${nationality}` : ''}.`,
    ]
    if (born && birthplace) parts.push(`Born ${born} in ${birthplace}.`)
    else if (born) parts.push(`Born ${born}.`)
    else if (birthplace) parts.push(`Originally from ${birthplace}.`)
    return parts.join(' ')
  }

  if (kind === 'place') {
    const country = pick(facts, 'country', 'located in the administrative territorial entity')
    const type = pick(facts, 'instance of')
    const population = pick(facts, 'population')
    const parts = [
      `${label} is${type ? ` a ${type.toLowerCase()}` : ' a notable place'}${country ? ` in ${country}` : ''}.`,
    ]
    if (population) parts.push(`Population is recorded at roughly ${population}.`)
    return parts.join(' ')
  }

  const type = pick(facts, 'instance of')
  if (type) return `${label} is documented as ${type.toLowerCase()} across reference sources.`
  return `${label} is covered in structured knowledge bases.`
}

function sectionNarrative(section) {
  const slots = section.slots ?? []
  if (!slots.length) return undefined
  const bits = slots.slice(0, 5).map((s) => `${s.label}: ${s.value}`).filter((b) => !b.endsWith(': '))
  if (!bits.length) return undefined
  if (section.id === 'summary') return bits.join(' · ')
  return `${section.title} — ${bits.join(' · ')}.`
}

function buildTimelineNarrative(label, kind, sections) {
  const timeline = sections?.find((s) => s.id === 'timeline')
  if (!timeline?.slots?.length) return undefined
  const count = timeline.slots.length
  const opener =
    kind === 'person'
      ? `${label}'s path includes ${count} documented milestones`
      : kind === 'org'
        ? `${label} evolved through ${count} notable phases`
        : `${count} key moments mark the story of ${label}`
  const highlights = timeline.slots.slice(0, 3).map((s) => s.value).join('; ')
  return `${opener}: ${highlights}.`
}

async function callOpenAI(body, apiKey) {
  const { label, kind, facts, sections, wikiLead } = body
  const factLines = (facts ?? [])
    .slice(0, 30)
    .map((f) => `- ${f.label}: ${f.value}`)
    .join('\n')

  const sectionBrief = (sections ?? [])
    .map((s) => `Section "${s.title}" (${s.id}): ${s.prompt}\nSlots: ${(s.slots ?? []).map((sl) => `${sl.label}=${sl.value}`).join('; ')}`)
    .join('\n\n')

  const system = `You write original, concise encyclopedia-style copy for entity profile pages.
Use ONLY the facts provided. Do not invent details. Never copy Wikipedia wording verbatim — paraphrase in fresh language.
For timeline sections with few slots, expand each milestone into a readable detail phrase.
Return valid JSON: {"summaryNarrative":"...","sections":[{"id":"...","narrative":"..."}]}`

  const user = `Entity: ${label} (${kind})
${wikiLead ? `Reference context (paraphrase, do not copy):\n${wikiLead.slice(0, 600)}\n` : ''}
Facts:
${factLines || '(none)'}

Sections to write:
${sectionBrief || '(summary only)'}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`)
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content
  if (!raw) throw new Error('Empty OpenAI response')

  const parsed = JSON.parse(raw)
  return {
    source: 'llm',
    summaryNarrative: parsed.summaryNarrative,
    sections: parsed.sections,
  }
}

/** @param {import('./aiSynthesize.types').AiSynthesizeRequest} body */
export async function handleAiSynthesize(body) {
  const apiKey = process.env.OPENAI_API_KEY
  if (apiKey) {
    try {
      return await callOpenAI(body, apiKey)
    } catch (err) {
      console.warn('[ai/synthesize] LLM failed, using template fallback:', err instanceof Error ? err.message : err)
    }
  }

  const summaryNarrative = buildSummaryNarrative(body.label, body.kind, body.facts)
  const sections = (body.sections ?? [])
    .map((s) => {
      let narrative =
        s.id === 'summary' ? summaryNarrative : s.id === 'timeline' ? buildTimelineNarrative(body.label, body.kind, body.sections) : sectionNarrative(s)
      return narrative ? { id: s.id, narrative } : null
    })
    .filter(Boolean)

  return {
    source: apiKey ? 'hybrid' : 'template',
    summaryNarrative,
    sections,
  }
}
