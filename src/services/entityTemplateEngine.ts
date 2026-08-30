import type { EntityKind } from '../types/entityArticle'
import type {
  CategoryContent,
  CategoryTemplate,
  FilledSection,
  FilledSlot,
  TemplateSectionDef,
  TemplateSlot,
} from '../types/entityTemplate'
import { templateForKind } from '../types/entityTemplate'
import type { EntityDossier, Milestone, VerifiedFact } from '../types/entityDossier'
import { formatFactDisplay } from '../utils/factFormatter'
import { buildOrgDashboardData } from './orgDashboardBuilder'
import { buildWorkDashboardData } from './workDashboardBuilder'
import { buildPersonDashboardData } from './personDashboardBuilder'
import { synthesizeNarrative } from './contentSynthesizer'

function factValues(facts: VerifiedFact[], keys: string[]): string[] {
  const want = new Set(keys.map((k) => k.toLowerCase()))
  const out: string[] = []
  const seen = new Set<string>()
  for (const f of facts) {
    if (!want.has(f.label.toLowerCase())) continue
    for (const v of f.values ?? [f.value]) {
      const key = v.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        out.push(v)
      }
    }
  }
  return out
}

function fillSlot(slot: TemplateSlot, facts: VerifiedFact[]): FilledSlot | null {
  const raw = factValues(facts, slot.factKeys)
  if (!raw.length) return null
  const formatted = formatFactDisplay(slot.label, raw)
  if (formatted.display === '—') return null
  return {
    id: slot.id,
    label: formatted.label,
    value: formatted.display,
    values: formatted.values,
  }
}

function narrativeForSection(
  section: TemplateSectionDef,
  label: string,
  kind: EntityKind,
  facts: VerifiedFact[],
  slots: FilledSlot[],
): string | undefined {
  if (section.id === 'summary') {
    return synthesizeNarrative(label, kind, facts)
  }

  const bits = slots.map((s) => `${s.label}: ${s.value}`)
  if (!bits.length) return undefined

  if (section.id === 'financials') {
    return `Financial profile — ${bits.join(' · ')}.`
  }
  if (section.id === 'creative') {
    return `Creative team — ${bits.slice(0, 4).join(' · ')}.`
  }
  if (section.id === 'career') {
    return `Career arc — ${bits.join(' · ')}.`
  }
  if (section.id === 'history') {
    return `From founding to today, ${label} has marked major milestones across decades of growth.`
  }
  if (section.id === 'identity') {
    return `${label}: ${bits.join(' · ')}.`
  }
  return bits.length >= 2 ? `${section.title} — ${bits.join(' · ')}.` : undefined
}

/** Build category-wise template content from verified facts + dossier. */
export function buildCategoryContent(
  dossier: EntityDossier,
  facts: VerifiedFact[],
): CategoryContent | undefined {
  const template = templateForKind(dossier.kind)
  if (!template) return undefined

  const sections: FilledSection[] = []

  for (const section of template.sections) {
    const slots = section.slots
      .map((s) => fillSlot(s, facts))
      .filter((s): s is FilledSlot => s !== null)

    if (section.layout === 'timeline') {
      let timeline: Milestone[] = []
      if (dossier.kind === 'org') timeline = buildOrgDashboardData(dossier).timeline
      else if (dossier.kind === 'work') timeline = buildWorkDashboardData(dossier).timeline
      else if (dossier.kind === 'person') timeline = buildPersonDashboardData(dossier).timeline

      if (!timeline.length && !slots.length) continue
      sections.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots: timeline.map((m, i) => ({
          id: `tl-${i}`,
          label: m.label,
          value: [m.year, m.detail].filter(Boolean).join(' — ') || m.label,
        })),
        source: 'template',
      })
      continue
    }

    if (section.layout === 'cast' && dossier.works.items.length) {
      sections.push({
        id: section.id,
        title: `${section.title} (${dossier.works.totalCount || dossier.works.items.length})`,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots: dossier.works.items.slice(0, 12).map((w, i) => ({
          id: `cast-${i}`,
          label: w.title,
          value: w.role ?? 'Cast',
        })),
        source: 'template',
      })
      continue
    }

    if (section.layout === 'films' && dossier.summary.topWorks.length) {
      sections.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots: dossier.summary.topWorks.map((w, i) => ({
          id: `film-${i}`,
          label: w.title,
          value: w.year ?? '',
        })),
        source: 'template',
      })
      continue
    }

    if (section.layout === 'awards' && dossier.summary.topAwards.length) {
      sections.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots: dossier.summary.topAwards.map((a, i) => ({
          id: `award-${i}`,
          label: a.name,
          value: a.year ?? 'Honour',
        })),
        source: 'template',
      })
      continue
    }

    if (section.layout === 'people' && dossier.kind === 'org') {
      const org = buildOrgDashboardData(dossier)
      if (!org.keyPeople.length && !slots.length) continue
      sections.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots: [
          ...slots,
          ...org.keyPeople.map((p, i) => ({ id: `person-${i}`, label: p.role, value: p.name })),
        ],
        source: 'template',
      })
      continue
    }

    if (section.layout === 'people' && dossier.family.members.length) {
      sections.push({
        id: section.id,
        title: section.title,
        layout: section.layout,
        slots: dossier.family.members.slice(0, 8).map((m, i) => ({
          id: `fam-${i}`,
          label: m.relation,
          value: m.name,
        })),
        source: 'template',
      })
      continue
    }

    if (section.layout === 'narrative' || slots.length > 0) {
      sections.push({
        id: section.id,
        title: section.title,
        subtitle: section.subtitle,
        layout: section.layout,
        narrative: narrativeForSection(section, dossier.label, dossier.kind, facts, slots),
        slots,
        source: 'template',
      })
    }
  }

  const summaryNarrative = synthesizeNarrative(dossier.label, dossier.kind, facts)

  return {
    templateId: template.id,
    kind: dossier.kind,
    sections,
    summaryNarrative,
    source: 'template',
  }
}

export function buildFallbackCategoryContent(
  dossier: EntityDossier,
  facts: VerifiedFact[],
): CategoryContent {
  let timeline: Milestone[] = []
  if (dossier.kind === 'org') timeline = buildOrgDashboardData(dossier).timeline
  else if (dossier.kind === 'work') timeline = buildWorkDashboardData(dossier).timeline
  else if (dossier.kind === 'person') timeline = buildPersonDashboardData(dossier).timeline

  const sections: FilledSection[] = []
  if (timeline.length) {
    sections.push({
      id: 'timeline',
      title: 'Timeline',
      layout: 'timeline',
      narrative: `Key dates and milestones in the story of ${dossier.label}.`,
      slots: timeline.map((m, i) => ({
        id: `tl-${i}`,
        label: m.label,
        value: [m.year, m.detail].filter(Boolean).join(' — ') || m.label,
      })),
      source: 'template',
    })
  }

  return {
    templateId: `${dossier.kind}-fallback`,
    kind: dossier.kind,
    sections,
    summaryNarrative: synthesizeNarrative(dossier.label, dossier.kind, facts),
    source: 'template',
  }
}

export function categoryTemplateMeta(kind: EntityKind): CategoryTemplate | undefined {
  return templateForKind(kind)
}
