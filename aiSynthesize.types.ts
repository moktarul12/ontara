export type AiSynthesizeRequest = {
  label: string
  kind: string
  templateId: string
  wikiLead?: string
  facts: { label: string; value: string }[]
  sections: {
    id: string
    title: string
    prompt: string
    slots: { label: string; value: string }[]
  }[]
}

export type AiSynthesizeResponse = {
  source: 'template' | 'llm' | 'hybrid'
  summaryNarrative?: string
  sections?: { id: string; narrative?: string }[]
}
