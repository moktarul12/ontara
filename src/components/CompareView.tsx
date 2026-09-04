import { useEffect, useMemo, useState } from 'react'
import type { OntologyStore } from '../hooks/useOntologyStore'
import { useCompareCategory } from '../hooks/useCompareCategory'
import { fetchDataProperties, fetchResourceClasses } from '../services/sparql'
import type { DataProperty, GraphNode } from '../types/ontology'
import { entityKey, entityUrisMatch } from '../utils/entityUrl'
import { kindOf } from '../utils/nodeKind'
import { findShortestPath } from '../utils/graphPath'
import { MAX_COMPARE } from './CompareSearchAdd'

export type ComparePin = { uri: string; label: string }

export { MAX_COMPARE }

interface Props {
  store: OntologyStore
  comparePins: ComparePin[]
  onOpen: (uri: string) => void
  onRemove: (uri: string) => void
  onClear: () => void
}

type PinMeta = {
  facts: DataProperty[]
  classes: string[]
  loading: boolean
}

function findOnMap(store: OntologyStore, uri: string): GraphNode | undefined {
  return store.graph.nodes.find((n) => entityUrisMatch(n.id, uri) || entityUrisMatch(n.uri, uri))
}

function resolveNode(store: OntologyStore, pin: ComparePin, meta?: PinMeta): GraphNode {
  const onMap = findOnMap(store, pin.uri)
  if (onMap) {
    if (meta?.facts.length && !onMap.dataProperties?.length) {
      return { ...onMap, dataProperties: meta.facts, classes: meta.classes.length ? meta.classes : onMap.classes }
    }
    return onMap
  }
  return {
    id: pin.uri,
    uri: pin.uri,
    label: pin.label,
    type: 'resource',
    dataProperties: meta?.facts,
    classes: meta?.classes,
  }
}

function neighborSet(store: OntologyStore, id: string): Set<string> {
  const out = new Set<string>()
  for (const l of store.graph.links) {
    const s = typeof l.source === 'string' ? l.source : l.source.id
    const t = typeof l.target === 'string' ? l.target : l.target.id
    if (s === id && !t.startsWith('relhub:') && !t.startsWith('literal:')) out.add(t)
    if (t === id && !s.startsWith('relhub:') && !s.startsWith('literal:')) out.add(s)
  }
  return out
}

function sharedNeighborCount(store: OntologyStore, a: string, b: string): number {
  const na = neighborSet(store, a)
  const nb = neighborSet(store, b)
  let count = 0
  for (const id of na) {
    if (nb.has(id)) count++
  }
  return count
}

/** Neighbors linked to every pinned entity on the map. */
function commonNeighborCount(store: OntologyStore, ids: string[]): number {
  const onMap = ids.filter((id) => store.graph.nodes.some((n) => entityUrisMatch(n.id, id)))
  if (onMap.length < 2) return 0
  let common = neighborSet(store, onMap[0])
  for (let i = 1; i < onMap.length; i++) {
    const next = neighborSet(store, onMap[i])
    common = new Set([...common].filter((id) => next.has(id)))
  }
  common.delete(onMap[0])
  for (const id of onMap) common.delete(id)
  return common.size
}

function factsForNode(store: OntologyStore, n: GraphNode, meta?: PinMeta): DataProperty[] {
  if (meta?.facts.length) return meta.facts.slice(0, 12)
  if (n.id === store.pathRootId && store.dataProperties.length) return store.dataProperties.slice(0, 12)
  return n.dataProperties?.slice(0, 12) ?? []
}

function CompareTable({
  columns,
}: {
  columns: { pin: ComparePin; node: GraphNode; facts: DataProperty[]; onMap: boolean }[]
}) {
  const propertyRows = useMemo(() => {
    const map = new Map<string, string>()
    for (const col of columns) {
      for (const f of col.facts) {
        if (!map.has(f.predicate)) map.set(f.predicate, f.predicateLabel || f.predicate)
      }
    }
    return [...map.entries()].slice(0, 14)
  }, [columns])

  return (
    <div className="compare-table-wrap">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col">Property</th>
            {columns.map((c) => (
              <th key={c.pin.uri} scope="col">
                {c.pin.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Kind</th>
            {columns.map((c) => (
              <td key={c.pin.uri}>{kindOf(c.node)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">On map</th>
            {columns.map((c) => (
              <td key={c.pin.uri}>{c.onMap ? 'Yes' : 'Pinned'}</td>
            ))}
          </tr>
          {propertyRows.map(([pred, label]) => (
            <tr key={pred}>
              <th scope="row">{label}</th>
              {columns.map((c) => {
                const val = c.facts.find((f) => f.predicate === pred)?.value ?? '—'
                return <td key={c.pin.uri}>{val.length > 100 ? `${val.slice(0, 100)}…` : val}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CompareView({ store, comparePins, onOpen, onRemove, onClear }: Props) {
  const [pinMeta, setPinMeta] = useState<Record<string, PinMeta>>({})
  const anchorUri = comparePins[0]?.uri
  const excludeUris = useMemo(() => comparePins.map((p) => p.uri), [comparePins])
  const { category } = useCompareCategory(store.config.endpoint, anchorUri, excludeUris)

  useEffect(() => {
    let cancelled = false
    for (const pin of comparePins) {
      const key = entityKey(pin.uri)
      const onMap = findOnMap(store, pin.uri)
      const fromMap = onMap?.dataProperties?.length
        ? onMap.dataProperties
        : onMap && entityUrisMatch(onMap.id, store.pathRootId ?? '')
          ? store.dataProperties
          : null
      if (fromMap?.length) continue

      void (async () => {
        setPinMeta((prev) => {
          if (prev[key]?.loading || prev[key]?.facts.length) return prev
          return { ...prev, [key]: { facts: [], classes: [], loading: true } }
        })

        try {
          const [facts, classes] = await Promise.all([
            fetchDataProperties(store.config.endpoint, pin.uri),
            fetchResourceClasses(store.config.endpoint, pin.uri),
          ])
          if (cancelled) return
          setPinMeta((prev) => ({
            ...prev,
            [key]: { facts, classes, loading: false },
          }))
        } catch {
          if (cancelled) return
          setPinMeta((prev) => ({
            ...prev,
            [key]: { facts: [], classes: [], loading: false },
          }))
        }
      })()
    }
    return () => {
      cancelled = true
    }
  }, [comparePins, store.config.endpoint, store.graph.nodes, store.pathRootId, store.dataProperties])

  const resolved = useMemo(
    () =>
      comparePins.map((pin) => {
        const meta = pinMeta[entityKey(pin.uri)]
        const node = resolveNode(store, pin, meta)
        const onMap = Boolean(findOnMap(store, pin.uri))
        return {
          pin,
          node,
          onMap,
          facts: factsForNode(store, node, meta),
          loading: meta?.loading ?? false,
        }
      }),
    [comparePins, pinMeta, store.graph.nodes, store.pathRootId, store.dataProperties],
  )

  const pairwise = useMemo(() => {
    const rows: { a: string; b: string; shared: number; hops: number | null; bothOnMap: boolean }[] = []
    for (let i = 0; i < resolved.length; i++) {
      for (let j = i + 1; j < resolved.length; j++) {
        const a = resolved[i].node.id
        const b = resolved[j].node.id
        const aOn = resolved[i].onMap
        const bOn = resolved[j].onMap
        let hops: number | null = null
        if (aOn && bOn) {
          const path = findShortestPath(store.graph, a, b)
          hops = path && path.steps.length > 1 ? path.steps.length - 1 : null
        }
        rows.push({
          a: resolved[i].pin.label,
          b: resolved[j].pin.label,
          shared: sharedNeighborCount(store, a, b),
          hops,
          bothOnMap: aOn && bOn,
        })
      }
    }
    return rows
  }, [resolved, store.graph])

  const commonAll = useMemo(
    () => commonNeighborCount(store, resolved.map((r) => r.node.id)),
    [resolved, store.graph.links, store.graph.nodes],
  )

  const anyLoading = resolved.some((r) => r.loading)

  const card = (r: (typeof resolved)[number]) => {
    const { node, pin, facts, onMap, loading } = r
    return (
      <article className="phase-card compare-card">
        <div className="compare-card-head">
          <strong>{pin.label}</strong>
          <button type="button" className="linkish" onClick={() => onRemove(pin.uri)}>
            Remove
          </button>
        </div>
        <p>Kind: {kindOf(node)}</p>
        <p>On map: {onMap ? 'Yes' : 'Pinned only'}</p>
        {loading && <p className="muted">Loading facts…</p>}
        <dl className="compare-facts">
          {facts.slice(0, 6).map((p, i) => (
            <div key={`${p.predicate}-${i}`}>
              <dt>{p.predicateLabel}</dt>
              <dd>{(p.value || '').slice(0, 120)}</dd>
            </div>
          ))}
          {!loading && !facts.length && (
            <p className="muted">No facts loaded yet.</p>
          )}
        </dl>
        <button type="button" className="eh-btn" onClick={() => onOpen(pin.uri)}>
          Open as focus
        </button>
      </article>
    )
  }

  return (
    <div className="lens-view compare-view">
      <h2>
        Compare
        {comparePins.length > 0 ? ` (${comparePins.length}/${MAX_COMPARE})` : ''}
      </h2>
      {category && comparePins.length > 0 && (
        <p className="compare-view-category">
          Same category: <strong>{category.label}</strong>
        </p>
      )}

      {comparePins.length === 0 && (
        <p className="muted">
          Use the <strong>Compare builder</strong> on the right: pin one entity to lock a category
          (occupation, industry, or type), then add up to <strong>{MAX_COMPARE}</strong> peers in
          that category.
        </p>
      )}

      {comparePins.length === 1 && (
        <>
          <div className={`compare-grid count-1`}>
            <div>{card(resolved[0])}</div>
          </div>
          <p className="muted">
            Add one or two more from the right panel to see the full comparison table.
          </p>
        </>
      )}

      {resolved.length >= 2 && (
        <>
          <p className="compare-summary">
            Comparing <strong>{resolved.length}</strong> entit{resolved.length === 1 ? 'y' : 'ies'}
            {commonAll > 0 && (
              <>
                {' '}
                · Shared by all on map: <strong>{commonAll}</strong>
              </>
            )}
            {pairwise.map((row) => (
              <span key={`${row.a}-${row.b}`}>
                {' '}
                · {row.a} ↔ {row.b}: {row.shared} shared link{row.shared === 1 ? '' : 's'}
                {row.bothOnMap && row.hops != null
                  ? `, ${row.hops} hop${row.hops === 1 ? '' : 's'} apart`
                  : !row.bothOnMap
                    ? ' (open both on map for path distance)'
                    : ''}
              </span>
            ))}
          </p>

          {anyLoading && <p className="compare-search-meta muted">Loading compare data…</p>}

          <CompareTable columns={resolved} />

          <div className={`compare-grid count-${Math.min(resolved.length, MAX_COMPARE)}`}>
            {resolved.map((r) => (
              <div key={r.pin.uri}>{card(r)}</div>
            ))}
          </div>
        </>
      )}

      {comparePins.length > 0 && (
        <button type="button" className="eh-btn ghost" onClick={onClear}>
          Clear all
        </button>
      )}
    </div>
  )
}
