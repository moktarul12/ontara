/** Light editorial pass so Wikipedia prose reads as original summary copy, not a paste. */
export function editorializeWikiParagraph(text: string): string {
  if (!text?.trim()) return text

  let s = text.trim()
  s = s.replace(/\[\d+\]/g, '')
  s = s.replace(/\s+/g, ' ')

  const swaps: [RegExp, string][] = [
    [/\bis an American\b/gi, 'comes from the United States and works as an American'],
    [/\bis a British\b/gi, 'is a British'],
    [/\bwas born in\b/gi, 'entered the world in'],
    [/\bwas born on\b/gi, 'was born on'],
    [/\bis best known for\b/gi, 'is widely recognized for'],
    [/\bis known for\b/gi, 'built a reputation around'],
    [/\baccording to\b/gi, 'based on available records,'],
    [/\bit is noted that\b/gi, ''],
    [/\bhas been described as\b/gi, 'is often characterized as'],
    [/\bplayed a (?:key|major|significant) role\b/gi, 'shaped developments'],
    [/\bfounded in (\d{4})\b/gi, 'started in $1'],
    [/\bestablished in (\d{4})\b/gi, 'took shape in $1'],
    [/\bheadquartered in\b/gi, 'based in'],
    [/\bis a (\w+(?:\s+\w+){0,2}) (?:film|movie)\b/gi, 'stands as a $1 film'],
    [/\bis a (\w+(?:\s+\w+){0,3})\b/gi, 'counts as a $1'],
  ]

  for (const [re, rep] of swaps) {
    s = s.replace(re, rep)
  }

  s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim()

  if (s.length > 40 && !/[.!?]$/.test(s)) s += '.'

  return s
}

export function editorializeWikiParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(editorializeWikiParagraph).filter((p) => p.length > 0)
}
