import { WIKIDATA_ENDPOINT } from '../types/ontology'
import type { ArticleTable } from '../types/entityArticle'
import { runSparql } from './sparql-core'

const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const WDT = 'http://www.wikidata.org/prop/direct/'

function qidFromUri(uri: string): string | null {
  const m = uri.match(/\/(Q\d+)$/i) || uri.match(/(Q\d+)/i)
  return m ? m[1].toUpperCase() : null
}

export async function fetchFilmographyTable(
  entityUri: string,
  lang: string,
): Promise<ArticleTable | null> {
  const qid = qidFromUri(entityUri)
  if (!qid) return null

  const query = `
    SELECT ?work ?workLabel ?year ?roleLabel WHERE {
      {
        ?work <${WDT}P161> <http://www.wikidata.org/entity/${qid}> .
      } UNION {
        <http://www.wikidata.org/entity/${qid}> <${WDT}P800> ?work .
      }
      ?work <${RDFS_LABEL}> ?workLabel .
      FILTER(LANG(?workLabel) = "${lang}" || LANG(?workLabel) = "en")
      OPTIONAL {
        ?work <${WDT}P577> ?date .
        BIND(YEAR(?date) AS ?year)
      }
      OPTIONAL {
        ?work <${WDT}P161> <http://www.wikidata.org/entity/${qid}> .
        ?work <http://www.wikidata.org/prop/P161> ?stmt .
        ?stmt <http://www.wikidata.org/prop/statement/P161> <http://www.wikidata.org/entity/${qid}> .
        OPTIONAL {
          ?stmt <http://www.wikidata.org/prop/qualifier/P453> ?role .
          ?role <${RDFS_LABEL}> ?roleLabel .
          FILTER(LANG(?roleLabel) = "${lang}" || LANG(?roleLabel) = "en")
        }
      }
    }
    ORDER BY DESC(?year)
    LIMIT 200
  `

  try {
    const rows = await runSparql(WIKIDATA_ENDPOINT, query, 16000)
    if (!rows.length) return null

    const seen = new Set<string>()
    const tableRows: Record<string, string>[] = []
    for (const r of rows) {
      const title = r.workLabel?.value?.trim()
      if (!title) continue
      const key = title.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      tableRows.push({
        year: r.year?.value ?? '—',
        title,
        role: r.roleLabel?.value ?? '—',
      })
    }

    if (!tableRows.length) return null

    const filledRoles = tableRows.filter((r) => r.role && r.role !== '—').length
    const showRole = filledRoles >= tableRows.length * 0.2
    const columns = showRole
      ? [
          { key: 'year', label: 'Year' },
          { key: 'title', label: 'Title' },
          { key: 'role', label: 'Role' },
        ]
      : [
          { key: 'year', label: 'Year' },
          { key: 'title', label: 'Title' },
        ]

    return {
      id: 'filmography',
      title: 'Selected filmography',
      columns,
      rows: tableRows.slice(0, 200),
    }
  } catch {
    return null
  }
}

export async function fetchAwardsTable(
  entityUri: string,
  lang: string,
): Promise<ArticleTable | null> {
  const qid = qidFromUri(entityUri)
  if (!qid) return null

  const query = `
    SELECT ?award ?awardLabel ?year ?result WHERE {
      {
        <http://www.wikidata.org/entity/${qid}> <${WDT}P166> ?award .
        BIND("Won" AS ?result)
      } UNION {
        <http://www.wikidata.org/entity/${qid}> <${WDT}P1411> ?award .
        BIND("Nominated" AS ?result)
      }
      ?award <${RDFS_LABEL}> ?awardLabel .
      FILTER(LANG(?awardLabel) = "${lang}" || LANG(?awardLabel) = "en")
      OPTIONAL {
        ?award <${WDT}P585> ?date .
        BIND(YEAR(?date) AS ?year)
      }
    }
    ORDER BY DESC(?year)
    LIMIT 80
  `

  try {
    const rows = await runSparql(WIKIDATA_ENDPOINT, query, 14000)
    if (!rows.length) return null

    const tableRows: Record<string, string>[] = []
    const seen = new Set<string>()
    for (const r of rows) {
      const award = r.awardLabel?.value?.trim()
      if (!award) continue
      const key = `${award}|${r.result?.value}`
      if (seen.has(key)) continue
      seen.add(key)
      tableRows.push({
        year: r.year?.value ?? '—',
        award,
        result: r.result?.value ?? '—',
      })
    }

    if (!tableRows.length) return null

    return {
      id: 'awards',
      title: 'Awards and nominations',
      columns: [
        { key: 'year', label: 'Year' },
        { key: 'award', label: 'Award' },
        { key: 'result', label: 'Result' },
      ],
      rows: tableRows,
    }
  } catch {
    return null
  }
}
