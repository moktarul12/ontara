/** Strip Wikipedia UI cruft from section titles and body text. */
export function cleanWikiSectionTitle(title: string): string {
  return title.replace(/\s*\[edit\]\s*$/i, '').trim()
}

export function cleanWikiParagraphText(text: string): string {
  if (!text?.trim()) return ''
  return text
    .replace(/\s*\[edit\]\s*/gi, ' ')
    .replace(/\s*Further information:\s*[^.]+\.\s*/gi, '')
    .replace(/\s*See also:\s*[^.]+\.\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Break a wall of text into readable paragraphs at sentence boundaries. */
export function splitLongParagraph(text: string, maxChars = 420): string[] {
  const cleaned = cleanWikiParagraphText(text)
  if (!cleaned) return []
  if (cleaned.length <= maxChars) return [cleaned]

  const sentences = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) ?? [cleaned]
  const out: string[] = []
  let buf = ''

  for (const sentence of sentences) {
    const s = sentence.trim()
    if (!s) continue
    if (buf.length > 0 && buf.length + s.length + 1 > maxChars) {
      out.push(buf.trim())
      buf = s
    } else {
      buf = buf ? `${buf} ${s}` : s
    }
  }

  if (buf.trim()) out.push(buf.trim())
  return out.length ? out : [cleaned]
}

export function normalizeSectionParagraphs(paragraphs: string[]): string[] {
  return paragraphs.flatMap((p) => splitLongParagraph(p)).filter((p) => p.length > 12)
}
