import { describe, expect, it } from 'vitest'
import { exportGraphJson, exportNodesCsv } from './graphExport'
import type { GraphData } from '../types/ontology'

const graph: GraphData = {
  nodes: [
    {
      id: 'http://www.wikidata.org/entity/Q9570',
      label: 'Amitabh Bachchan',
      uri: 'http://www.wikidata.org/entity/Q9570',
      type: 'resource',
      __hopDepth: 0,
    },
  ],
  links: [],
}

describe('graphExport', () => {
  it('exports JSON with seed meta', () => {
    const json = exportGraphJson(graph, {
      seedUri: 'http://www.wikidata.org/entity/Q9570',
      seedLabel: 'Amitabh Bachchan',
      source: 'wikidata',
    })
    const parsed = JSON.parse(json)
    expect(parsed.seed.seedLabel).toBe('Amitabh Bachchan')
    expect(parsed.nodes).toHaveLength(1)
  })

  it('exports CSV with header row', () => {
    const csv = exportNodesCsv(graph)
    expect(csv.split('\n')[0]).toBe('id,label,uri,type,kind,hopDepth')
    expect(csv).toContain('Amitabh Bachchan')
  })
})
