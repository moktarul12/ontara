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
): Promise<EntityDossier> {
  const uris = new Set<string>([dossier.uri])
  for (const f of profile.facts) {
    if (f.valueUri) uris.add(f.valueUri)
  }

  const images = await fetchEntityImagesBatch([...uris], 320)
  const heroImage =
    images[dossier.uri] ??
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
