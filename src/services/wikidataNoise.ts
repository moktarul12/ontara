/**
 * Wikidata media / URL noise — never put these on the knowledge graph canvas.
 * (Commons FilePath IRIs become nodes labeled “Something.jpg” without this.)
 */

const WDT = 'http://www.wikidata.org/prop/direct/'

/** Media & map image properties (commonsMedia). */
export const WD_MEDIA_PREDICATES = new Set([
  `${WDT}P18`, // image
  `${WDT}P154`, // logo image
  `${WDT}P109`, // signature
  `${WDT}P41`, // flag image
  `${WDT}P94`, // coat of arms
  `${WDT}P242`, // locator map
  `${WDT}P2716`, // collage image
  `${WDT}P6802`, // related image
  `${WDT}P8972`, // small logo or icon
  `${WDT}P14`, // traffic sign
  `${WDT}P15`, // route map
  `${WDT}P117`, // chemical structure
  `${WDT}P1621`, // detail map
  `${WDT}P5555`, // schematic
])

/** URL / identifier properties that should stay off the canvas. */
export const WD_URL_PREDICATES = new Set([
  `${WDT}P856`, // official website
  `${WDT}P973`, // described at URL
  `${WDT}P953`, // full work available at URL
  `${WDT}P1019`, // web feed URL
  `${WDT}P1065`, // archive URL
  `${WDT}P2699`, // URL
  `${WDT}P1325`, // external data available at URL
  `${WDT}P854`, // reference URL (sometimes as statement)
])

export function isWikidataNoisePredicate(predicate: string): boolean {
  if (WD_MEDIA_PREDICATES.has(predicate)) return true
  if (WD_URL_PREDICATES.has(predicate)) return true
  return false
}

/** Commons / file IRIs that must never become graph nodes. */
export function isWikidataNoiseObject(uri: string): boolean {
  if (!uri) return false
  const u = uri.toLowerCase()
  if (u.includes('/wiki/special:filepath')) return true
  if (u.includes('commons.wikimedia.org') && /\.(jpe?g|png|gif|svg|webp|tif{1,2}|pdf)(\?|$)/i.test(u))
    return true
  if (/\.(jpe?g|png|gif|svg|webp)(\?|#|$)/i.test(u)) return true
  if (u.startsWith('http://www.wikidata.org/entity/p') && /\/entity\/p\d+$/i.test(uri)) return true
  return false
}

export function filterWikidataRelations<T extends { predicate: string }>(rels: T[]): T[] {
  return rels.filter((r) => !isWikidataNoisePredicate(r.predicate))
}

export function filterWikidataNodes<T extends { uri: string }>(nodes: T[]): T[] {
  return nodes.filter((n) => !isWikidataNoiseObject(n.uri))
}
