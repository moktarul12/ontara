import { useMemo } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import type { DataProperty, GraphNode } from '../types/ontology'
import {
  mergeTimeline,
  timelineFromDataProperties,
  timelineFromLabels,
} from '../utils/timelineDates'
import { kindOf } from '../utils/nodeKind'
import type { EntityTab } from './EntityHeader'

interface Props {
  store: OntologyStore
  tab: EntityTab
  onSelect: (id: string) => void
  onOpen: (uri: string) => void
}

function isOrgNode(n: GraphNode, entityKind: string, rootId: string | null) {
  return kindOf(n) === 'org' || (n.id === rootId && entityKind === 'org')
}

function collectDataProperties(store: OntologyStore): DataProperty[] {
  const root = store.graph.nodes.find((n) => n.id === store.pathRootId)
  const selected = store.selectedNode
  const merged = [
    ...(root?.dataProperties ?? []),
    ...store.dataProperties,
    ...(selected?.dataProperties ?? []),
  ]
  const seen = new Set<string>()
  return merged.filter((p) => {
    const key = `${p.predicate}:${p.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function orgFacts(props: DataProperty[]) {
  const hints =
    /founded|inception|industry|headquarters|location|country|employees|revenue|stock|ceo|chief|parent|subsidiary|instance of/i
  return props.filter((p) => hints.test(`${p.predicateLabel} ${p.predicate}`)).slice(0, 12)
}

export function LensView({ store, tab, onSelect, onOpen }: Props) {
  const nodes = store.graph.nodes.filter((n) => n.type === 'resource')
  const root = store.graph.nodes.find((n) => n.id === store.pathRootId)
  const allProps = useMemo(() => collectDataProperties(store), [
    store.graph.nodes,
    store.dataProperties,
    store.pathRootId,
    store.selectedNode,
  ])

  const byKind = useMemo(() => {
    const map = {
      person: nodes.filter((n) => kindOf(n) === 'person'),
      org: nodes.filter((n) => isOrgNode(n, store.entityKind, store.pathRootId)),
      work: nodes.filter((n) => kindOf(n) === 'work'),
      place: nodes.filter((n) => kindOf(n) === 'place'),
      music: nodes.filter(
        (n) =>
          kindOf(n) === 'work' &&
          /song|album|music|soundtrack|single/i.test(
            `${n.label} ${n.classes?.join(' ') ?? ''}`,
          ),
      ),
    }
    return map
  }, [nodes, store.entityKind, store.pathRootId])

  const timeline = useMemo(() => {
    const focusLabel = root?.label || store.config.seedLabel
    const fromProps = timelineFromDataProperties(allProps, focusLabel)
    const fromLabels = timelineFromLabels(
      nodes.map((n) => ({ id: n.id, label: n.label })),
    )
    return mergeTimeline(fromProps, fromLabels).map((e) => ({
      label: e.label,
      year: e.year,
      predicateLabel: e.predicateLabel,
      nodeId: e.sourceUri,
    }))
  }, [allProps, nodes, root?.label, store.config.seedLabel])

  if (tab === 'business') {
    const facts = orgFacts(allProps)
    return (
      <div className="lens-view">
        <h2>Business lens</h2>
        <p>Organizations, leadership, and company facts for the focus and connected nodes.</p>

        {root && store.entityKind === 'org' && (
          <article className="lens-card lens-focus-card">
            <strong>{root.label}</strong>
            <em>Focus organization</em>
            {facts.length > 0 ? (
              <dl className="lens-facts">
                {facts.map((p, i) => (
                  <div key={`${p.predicate}-${i}`}>
                    <dt>{p.predicateLabel}</dt>
                    <dd>{(p.value || '').slice(0, 140)}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="muted">
                Expand <strong>Leadership</strong> or <strong>Identity</strong> facets on the graph
                tab to load company details.
              </p>
            )}
          </article>
        )}

        <h3>Organizations on map</h3>
        <div className="lens-grid">
          {byKind.org.map((n) => (
            <button key={n.id} type="button" className="lens-card" onClick={() => onOpen(n.id)}>
              <strong>{n.label}</strong>
              <em>Organization · hop {n.__hopDepth ?? 0}</em>
            </button>
          ))}
          {!byKind.org.length && !facts.length && (
            <p className="muted">No organizations yet — switch to Graph and expand org facets.</p>
          )}
        </div>

        <h3>People (leadership &amp; connections)</h3>
        <div className="lens-chip-row">
          {byKind.person.slice(0, 24).map((n) => (
            <button key={n.id} type="button" className="phase-chip" onClick={() => onSelect(n.id)}>
              {n.label}
            </button>
          ))}
          {!byKind.person.length && (
            <p className="muted">No people on the map yet — expand Leadership on the graph tab.</p>
          )}
        </div>
      </div>
    )
  }

  if (tab === 'music') {
    return (
      <div className="lens-view">
        <h2>Music lens</h2>
        <p>Songs, albums and soundtrack-linked works.</p>
        <div className="lens-grid">
          {(byKind.music.length ? byKind.music : byKind.work).map((n) => (
            <button key={n.id} type="button" className="lens-card" onClick={() => onOpen(n.id)}>
              <strong>{n.label}</strong>
              <em>{kindOf(n)} · hop {n.__hopDepth ?? 0}</em>
            </button>
          ))}
          {!byKind.work.length && <p className="muted">No works on the map yet.</p>}
        </div>
      </div>
    )
  }

  if (tab === 'places') {
    return (
      <div className="lens-view">
        <h2>Places lens</h2>
        <p>Geographic entities connected to the focus.</p>
        <div className="lens-grid">
          {byKind.place.map((n) => (
            <button key={n.id} type="button" className="lens-card" onClick={() => onOpen(n.id)}>
              <strong>{n.label}</strong>
              <em>Place · hop {n.__hopDepth ?? 0}</em>
            </button>
          ))}
          {!byKind.place.length && <p className="muted">No places yet — deepen geography hops.</p>}
        </div>
      </div>
    )
  }

  if (tab === 'timeline') {
    return (
      <div className="lens-view">
        <h2>Timeline lens</h2>
        <p>Dated facts from Wikidata properties and year mentions on the map.</p>
        <ol className="timeline-list">
          {timeline.map((t) => (
            <li key={`${t.year}-${t.predicateLabel}-${t.label}`}>
              <span className="tl-year">{t.year}</span>
              {t.nodeId ? (
                <button type="button" className="linkish" onClick={() => onSelect(t.nodeId!)}>
                  {t.label}
                </button>
              ) : (
                <span>{t.label}</span>
              )}
              <em className="tl-pred">{t.predicateLabel}</em>
            </li>
          ))}
          {!timeline.length && (
            <li className="muted">
              No dated facts yet — expand facets on the Graph tab or apply more hops.
            </li>
          )}
        </ol>
      </div>
    )
  }

  if (tab === 'table') {
    const rows = nodes
      .map((n) => ({
        id: n.id,
        label: n.label,
        kind: kindOf(n),
        hop: n.__hopDepth ?? 0,
        classes: (n.classes ?? []).slice(0, 2).join(', '),
      }))
      .sort((a, b) => a.hop - b.hop || a.label.localeCompare(b.label))
    return (
      <div className="lens-view">
        <h2>Table view</h2>
        <p>Graph + table parity — sort/filter mentally; click to focus a node.</p>
        <div className="phase-table-wrap">
          <table className="phase-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Kind</th>
                <th>Hop</th>
                <th>Classes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => onSelect(r.id)}>
                      {r.label}
                    </button>
                  </td>
                  <td>{r.kind}</td>
                  <td>{r.hop}</td>
                  <td>{r.classes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return null
}
