import type { EntityDossier } from '../types/entityDossier'
import type { EntityProfile } from './entityProfile'
import { fetchEntityImagesBatch, upscaleWikiThumb } from './entityImages'

function withImage<T extends { uri?: string; imageUrl?: string }>(
  item: T,
  images: Record<string, string>,
): T {
  if (!item.uri) return item
  const img = images[item.uri]
  return img ? { ...item, imageUrl: img } : item
}

/** Attach portrait/poster URLs to dossier hero, cast, family, and filmography. */
export async function enrichDossierWithImages(
  dossier: EntityDossier,
  profile: EntityProfile,
  wikiLeadImage?: string,
  opts: { maxRelated?: number } = {},
): Promise<EntityDossier> {
  const maxRelated = opts.maxRelated ?? 16
  const uris = new Set<string>()
  // Prefer family / works preview URIs — not every claim value (that was dozens of API calls).
  for (const m of dossier.summary.familyPreview) {
    if (m.uri) uris.add(m.uri)
  }
  for (const m of dossier.family.members) {
    if (m.uri) uris.add(m.uri)
  }
  for (const w of dossier.summary.topWorks) {
    if (w.uri) uris.add(w.uri)
  }
  for (const w of dossier.works.items.slice(0, 8)) {
    if (w.uri) uris.add(w.uri)
  }
  if (uris.size < maxRelated) {
    for (const f of profile.facts) {
      if (f.valueUri && uris.size < maxRelated) uris.add(f.valueUri)
    }
  }

  const images = await fetchEntityImagesBatch([...uris].slice(0, maxRelated), 320)
  const heroImage =
    dossier.hero.imageUrl ??
    upscaleWikiThumb(wikiLeadImage, 480)

  return {
    ...dossier,
    hero: { ...dossier.hero, imageUrl: heroImage },
    works: {
      ...dossier.works,
      items: dossier.works.items.map((w) => withImage(w, images)),
    },
    summary: {
      ...dossier.summary,
      topWorks: dossier.summary.topWorks.map((w) => withImage(w, images)),
      familyPreview: dossier.summary.familyPreview.map((m) => withImage(m, images)),
    },
    family: {
      ...dossier.family,
      members: dossier.family.members.map((m) => withImage(m, images)),
    },
  }
}
