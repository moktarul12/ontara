/** Decode HTML entities including numeric forms common in Wikipedia markup. */
export function decodeHtmlEntities(text: string): string {
  if (!text) return ''
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

/** Strip Wikipedia HTML to readable plain text paragraphs. */
export function htmlToPlainText(html: string): string {
  if (!html) return ''
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  s = decodeHtmlEntities(s)
  s = s.replace(/\[\d+\]/g, '')
  s = s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

export function htmlToParagraphs(html: string): string[] {
  if (!html) return []

  const fromPTags: string[] = []
  const pTagRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let match: RegExpExecArray | null
  while ((match = pTagRe.exec(html))) {
    const t = htmlToPlainText(match[0])
    if (t.length > 12) fromPTags.push(t)
  }
  if (fromPTags.length > 0) return fromPTags

  const text = htmlToPlainText(html)
  if (!text) return []
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 12)
}

/** Extract external URLs from a Wikipedia section HTML list. */
export function htmlToExternalLinks(html: string): { label: string; url: string }[] {
  if (!html) return []
  const links: { label: string; url: string }[] = []
  const re = /<a[^>]+href="(https?:\/\/[^"#]+)"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const url = decodeHtmlEntities(m[1])
    const label = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    if (!label || /^(edit|Jump to)$/i.test(label)) continue
    if (links.some((l) => l.url === url)) continue
    links.push({ label, url })
  }
  return links
}
