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
  `${WDT}P345`, // IMDb ID
  `${WDT}P214`, // VIAF
  `${WDT}P244`, // Library of Congress authority ID
  `${WDT}P213`, // ISNI
  `${WDT}P227`, // GND ID
  `${WDT}P646`, // Freebase ID
  `${WDT}P2387`, // Elonet person ID
  `${WDT}P2605`, // ČSFD person ID
  `${WDT}P4985`, // TMDB person ID
  `${WDT}P2002`, // X (Twitter) username
  `${WDT}P2003`, // Instagram username
  `${WDT}P2013`, // Facebook ID
  `${WDT}P2397`, // YouTube channel ID
  `${WDT}P434`, // MusicBrainz artist ID
  `${WDT}P1953`, // Discogs artist ID
  `${WDT}P269`, // IdRef ID
  `${WDT}P268`, // BnF ID
  `${WDT}P1006`, // NTA ID
  `${WDT}P396`, // SBN author ID
  `${WDT}P950`, // BNE ID
  `${WDT}P349`, // NDL Auth ID
  `${WDT}P1005`, // PTBNP ID
  `${WDT}P691`, // NKCR AUT ID
  `${WDT}P7293`, // PLWABN ID
  `${WDT}P3987`, // SHARE Catalogue author ID
  `${WDT}P9984`, // CANTIC ID
  `${WDT}P5513`, // Enciclopèdia de l'Esport Català ID
  `${WDT}P1417`, // Encyclopædia Britannica Online ID
  `${WDT}P3219`, // Encyclopædia Universalis ID
  `${WDT}P3417`, // Quora topic ID
  `${WDT}P3365`, // Treccani ID
  `${WDT}P10527`, // Télé-Loisirs ID
  `${WDT}P1266`, // AlloCiné person ID
  `${WDT}P2519`, // Scope.dk person ID
  `${WDT}P2435`, // PORT person ID
  `${WDT}P5034`, // National Library of Korea ID
  `${WDT}P5033`, // Filmweb.pl person ID
  `${WDT}P2168`, // Swedish Film Database person ID
  `${WDT}P2604`, // Kinopoisk person ID
  `${WDT}P4282`, // LUMIERE people ID
  `${WDT}P8971`, // Cinémathèque québécoise person ID
  `${WDT}P7400`, // LibraryThing author ID
  `${WDT}P2963`, // Goodreads author ID
  `${WDT}P1207`, // NUKAT ID
  `${WDT}P1315`, // NLA Trove people ID
  `${WDT}P7369`, // National Library of Chile ID
  `${WDT}P409`, // Libraries Australia ID
  `${WDT}P1368`, // LNB ID
  `${WDT}P1309`, // EGAXA ID
  `${WDT}P949`, // National Library of Israel ID
  `${WDT}P3348`, // National Library of Greece ID
  `${WDT}P1273`, // CANTIC ID (old)
  `${WDT}P906`, // SELIBR ID
  `${WDT}P1003`, // National Library of Romania ID
  `${WDT}P1695`, // NLP ID
  `${WDT}P1375`, // NSK ID
  `${WDT}P12483`, // Umění Artlist person ID
])

/** Wikidata ranks / meta that clutter the map. */
export const WD_META_PREDICATES = new Set([
  `${WDT}P31`, // instance of — often noise when many Q-types
  `${WDT}P735`, // given name chips can flood
  `${WDT}P734`, // family name
  `${WDT}P1559`, // name in native language
  `${WDT}P1477`, // birth name
  `${WDT}P1449`, // nickname
  `${WDT}P1705`, // native label
  `${WDT}P1813`, // short name
  `${WDT}P742`, // pseudonym
])

export function isWikidataNoisePredicate(predicate: string): boolean {
  if (WD_MEDIA_PREDICATES.has(predicate)) return true
  if (WD_URL_PREDICATES.has(predicate)) return true
  if (WD_META_PREDICATES.has(predicate)) return true
  // External-ID snak pattern /prop/direct/P#### that look like pure IDs — keep named above
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
