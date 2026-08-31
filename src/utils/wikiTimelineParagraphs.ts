const MONTH =
  'January|February|March|April|May|June|July|August|September|October|November|December'

/** "On December 12, 1980," at the start of a Wikipedia history paragraph. */
const ON_DATE_PREFIX_RE = new RegExp(
  `^(On\\s+(?:${MONTH})\\s+\\d{1,2},\\s+\\d{4},?)\\s+(.+)$`,
  'i',
)

export function isHistoryChapter(section: { id: string; title: string }): boolean {
  const title = section.title.trim()
  return /^(history|legacy|chronology)$/i.test(title) || /(^|\/)history$/i.test(section.id)
}

/** Wikipedia era subheadings such as "1976–1984: Founding and incorporation". */
export function isEraTimelineTitle(title: string): boolean {
  const t = title.trim()
  return /^\d{4}\s*[–-]\s*(\d{4}|present)\s*:/i.test(t) || /^\d{4}\s*:/.test(t)
}

export function splitTimelineParagraph(text: string): { heading?: string; body: string } {
  const cleaned = text.trim()
  if (!cleaned) return { body: '' }

  const onDate = cleaned.match(ON_DATE_PREFIX_RE)
  if (onDate) {
    return { heading: onDate[1].trim(), body: onDate[2].trim() }
  }

  return { body: cleaned }
}
