import { useCallback, useMemo, useReducer, useRef } from 'react'
import type {
  ConnectedNode,
  DataProperty,
  GraphData,
  GraphLink,
  GraphNode,
  OntologyConfig,
  RelationType,
} from '../types/ontology'
import { DEFAULT_CONFIG } from '../types/ontology'
import {
  fetchConnectedNodes,
  fetchDataProperties,
  fetchEntityKnowledgeGraph,
  fetchHopLayer,
  fetchOntologyClassMap,
  fetchRelationTypes,
  fetchResourceClasses,
  fetchSeedNeighborhood,
  isOntologyClassUri,
  localName,
  type HopDirection,
} from '../services/sparql'
import { findShortestPath, type HopTrailStep, type PathStep } from '../utils/graphPath'

type PanelMode = 'idle' | 'relations' | 'neighbors' | 'details' | 'search'

interface ExploreState {
  config: OntologyConfig
  graph: GraphData
  selectedNodeId: string | null
  /** Root of current KG / path walks */
  pathRootId: string | null
  activeRelation: RelationType | null
  relationTypes: RelationType[]
  neighbors: ConnectedNode[]
  selectedNeighborUris: Set<string>
  dataProperties: DataProperty[]
  panelMode: PanelMode
  loading: boolean
  loadingMessage: string
  error: string | null
  highlightedLinkId: string | null
  lastExpandMessage: string | null
  graphEpoch: number
  /** Gold-highlighted multi-hop path on canvas */
  pathNodeIds: string[]
  pathLinkIds: string[]
  pathSteps: PathStep[]
  /** Expand-hops diary */
  hopTrail: HopTrailStep[]
  /** Current max hop depth on the graph (0 = seed only). */
  appliedHopDepth: number
}

type Action =
  | { type: 'SET_CONFIG'; config: Partial<OntologyConfig> }
  | { type: 'SET_LOADING'; loading: boolean; message?: string }
  | { type: 'SET_ERROR'; error: string | null }
  | {
      type: 'RESET_GRAPH'
      graph: GraphData
      seedId: string
      panelMode?: PanelMode
      message?: string
      bumpEpoch?: boolean
    }
  | { type: 'SELECT_NODE'; id: string | null }
  | { type: 'SET_RELATIONS'; relations: RelationType[] }
  | { type: 'SET_ACTIVE_RELATION'; relation: RelationType | null }
  | { type: 'SET_NEIGHBORS'; neighbors: ConnectedNode[] }
  | { type: 'TOGGLE_NEIGHBOR'; uri: string }
  | { type: 'SELECT_ALL_NEIGHBORS'; selected: boolean }
  | { type: 'SET_DATA_PROPERTIES'; props: DataProperty[] }
  | { type: 'SET_PANEL'; mode: PanelMode }
  | { type: 'ADD_NODES'; nodes: GraphNode[]; links: GraphLink[]; message?: string }
  | { type: 'HIGHLIGHT_LINK'; id: string | null }
  | { type: 'UPDATE_NODE_META'; id: string; classes?: string[]; dataProperties?: DataProperty[] }
  | { type: 'CLEAR_EXPAND_MESSAGE' }
  | { type: 'CLEAR_GRAPH' }
  | {
      type: 'SET_PATH'
      steps: PathStep[]
      nodeIds: string[]
      linkIds: string[]
    }
  | { type: 'CLEAR_PATH' }
  | { type: 'SET_HOP_TRAIL'; trail: HopTrailStep[] }
  | { type: 'PUSH_HOP_TRAIL'; step: HopTrailStep }
  | { type: 'SET_APPLIED_HOPS'; depth: number }
  | { type: 'TRIM_TO_HOPS'; maxDepth: number; message?: string }

const initialState: ExploreState = {
  config: { ...DEFAULT_CONFIG },
  graph: { nodes: [], links: [] },
  selectedNodeId: null,
  pathRootId: null,
  activeRelation: null,
  relationTypes: [],
  neighbors: [],
  selectedNeighborUris: new Set(),
  dataProperties: [],
  panelMode: 'idle',
  loading: false,
  loadingMessage: '',
  error: null,
  highlightedLinkId: null,
  lastExpandMessage: null,
  graphEpoch: 0,
  pathNodeIds: [],
  pathLinkIds: [],
  pathSteps: [],
  hopTrail: [],
  appliedHopDepth: 0,
}

function reducer(state: ExploreState, action: Action): ExploreState {
  switch (action.type) {
    case 'SET_CONFIG':
      return { ...state, config: { ...state.config, ...action.config } }
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.loading,
        loadingMessage: action.message ?? (action.loading ? state.loadingMessage : ''),
        error: action.loading ? null : state.error,
      }
    case 'SET_ERROR':
      return { ...state, error: action.error, loading: false }
    case 'RESET_GRAPH':
      return {
        ...state,
        graph: action.graph,
        selectedNodeId: action.seedId,
        pathRootId: action.seedId,
        activeRelation: null,
        relationTypes: [],
        neighbors: [],
        selectedNeighborUris: new Set(),
        dataProperties: [],
        panelMode: action.panelMode ?? 'relations',
        highlightedLinkId: null,
        lastExpandMessage: action.message ?? null,
        graphEpoch: action.bumpEpoch === false ? state.graphEpoch : state.graphEpoch + 1,
        pathNodeIds: [],
        pathLinkIds: [],
        pathSteps: [],
        hopTrail: [],
        appliedHopDepth: Math.max(
          0,
          ...action.graph.nodes.map((n) => n.__hopDepth ?? 0),
        ),
      }
    case 'CLEAR_GRAPH':
      return {
        ...state,
        graph: { nodes: [], links: [] },
        selectedNodeId: null,
        pathRootId: null,
        activeRelation: null,
        relationTypes: [],
        neighbors: [],
        selectedNeighborUris: new Set(),
        dataProperties: [],
        panelMode: 'idle',
        highlightedLinkId: null,
        lastExpandMessage: null,
        graphEpoch: state.graphEpoch + 1,
        pathNodeIds: [],
        pathLinkIds: [],
        pathSteps: [],
        hopTrail: [],
        appliedHopDepth: 0,
      }
    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.id,
        activeRelation: null,
        neighbors: [],
        selectedNeighborUris: new Set(),
        lastExpandMessage: null,
      }
    case 'SET_RELATIONS':
      return { ...state, relationTypes: action.relations }
    case 'SET_ACTIVE_RELATION':
      return {
        ...state,
        activeRelation: action.relation,
        selectedNeighborUris: new Set(),
      }
    case 'SET_NEIGHBORS':
      return {
        ...state,
        neighbors: action.neighbors,
        panelMode: 'neighbors',
        selectedNeighborUris: new Set(),
      }
    case 'TOGGLE_NEIGHBOR': {
      const next = new Set(state.selectedNeighborUris)
      if (next.has(action.uri)) next.delete(action.uri)
      else next.add(action.uri)
      return { ...state, selectedNeighborUris: next }
    }
    case 'SELECT_ALL_NEIGHBORS': {
      if (!action.selected) return { ...state, selectedNeighborUris: new Set() }
      return {
        ...state,
        selectedNeighborUris: new Set(state.neighbors.map((n) => n.uri)),
      }
    }
    case 'SET_DATA_PROPERTIES':
      return { ...state, dataProperties: action.props }
    case 'SET_PANEL':
      return { ...state, panelMode: action.mode }
    case 'ADD_NODES': {
      const existingIds = new Set(state.graph.nodes.map((n) => n.id))
      const existingLinks = new Set(state.graph.links.map((l) => l.id))
      const nodes = [
        ...state.graph.nodes,
        ...action.nodes.filter((n) => !existingIds.has(n.id)),
      ]
      const links = [
        ...state.graph.links,
        ...action.links.filter((l) => !existingLinks.has(l.id)),
      ]
      return {
        ...state,
        graph: { nodes, links },
        lastExpandMessage: action.message ?? null,
      }
    }
    case 'HIGHLIGHT_LINK':
      return { ...state, highlightedLinkId: action.id }
    case 'UPDATE_NODE_META': {
      const nodes = state.graph.nodes.map((n) =>
        n.id === action.id
          ? {
              ...n,
              classes: action.classes ?? n.classes,
              dataProperties: action.dataProperties ?? n.dataProperties,
            }
          : n,
      )
      return { ...state, graph: { ...state.graph, nodes } }
    }
    case 'CLEAR_EXPAND_MESSAGE':
      return { ...state, lastExpandMessage: null }
    case 'SET_PATH':
      return {
        ...state,
        pathSteps: action.steps,
        pathNodeIds: action.nodeIds,
        pathLinkIds: action.linkIds,
      }
    case 'CLEAR_PATH':
      return { ...state, pathSteps: [], pathNodeIds: [], pathLinkIds: [] }
    case 'SET_HOP_TRAIL':
      return { ...state, hopTrail: action.trail }
    case 'PUSH_HOP_TRAIL':
      return { ...state, hopTrail: [...state.hopTrail, action.step] }
    case 'SET_APPLIED_HOPS':
      return { ...state, appliedHopDepth: action.depth }
    case 'TRIM_TO_HOPS': {
      const root = state.pathRootId
      const keepIds = new Set(
        state.graph.nodes
          .filter((n) => {
            const d = n.__hopDepth ?? 0
            if (root && n.id === root) return true
            return d <= action.maxDepth
          })
          .map((n) => n.id),
      )
      const nodes = state.graph.nodes.filter((n) => keepIds.has(n.id))
      const links = state.graph.links.filter((l) => {
        const s = typeof l.source === 'string' ? l.source : l.source.id
        const t = typeof l.target === 'string' ? l.target : l.target.id
        return keepIds.has(s) && keepIds.has(t)
      })
      const sel =
        state.selectedNodeId && keepIds.has(state.selectedNodeId)
          ? state.selectedNodeId
          : root
      return {
        ...state,
        graph: { nodes, links },
        selectedNodeId: sel ?? null,
        appliedHopDepth: action.maxDepth,
        pathNodeIds: state.pathNodeIds.filter((id) => keepIds.has(id)),
        pathLinkIds: state.pathLinkIds.filter((id) => links.some((l) => l.id === id)),
        pathSteps: state.pathSteps.filter((s) => keepIds.has(s.nodeId)),
        hopTrail: state.hopTrail.filter((h) => h.depth <= action.maxDepth),
        lastExpandMessage: action.message ?? null,
        graphEpoch: state.graphEpoch + 1,
      }
    }
    default:
      return state
  }
}

function stampInitialHopDepths(nodes: GraphNode[], rootId: string): GraphNode[] {
  return nodes.map((n) => {
    if (n.id === rootId) return { ...n, __hopDepth: 0 }
    if (n.type === 'literal') return { ...n, __hopDepth: 1 }
    return { ...n, __hopDepth: n.__hopDepth ?? 1 }
  })
}

function linkId(source: string, predicate: string, target: string) {
  return `${source}|${predicate}|${target}`
}

function toGraphPieces(
  sourceId: string,
  rel: RelationType,
  items: ConnectedNode[],
): { nodes: GraphNode[]; links: GraphLink[] } {
  const nodes: GraphNode[] = items.map((n) => ({
    id: n.uri,
    uri: n.uri,
    label: n.label,
    type: isOntologyClassUri(n.uri) ? ('class' as const) : ('resource' as const),
    classes: n.typeLabel ? [n.typeLabel] : undefined,
    __pulse: 1,
  }))

  const links: GraphLink[] = items.map((n) => {
    const from = rel.direction === 'out' ? sourceId : n.uri
    const to = rel.direction === 'out' ? n.uri : sourceId
    return {
      id: linkId(from, rel.predicate, to),
      source: from,
      target: to,
      predicate: rel.predicate,
      predicateLabel: rel.predicateLabel.replace(/\s*\(.*\)$/, ''),
    }
  })

  return { nodes, links }
}

export function useOntologyStore() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const selectGen = useRef(0)

  const selectedNode = useMemo(
    () => state.graph.nodes.find((n) => n.id === state.selectedNodeId) ?? null,
    [state.graph.nodes, state.selectedNodeId],
  )

  const openKnowledgeGraph = useCallback(
    async (uri: string) => {
      const gen = ++selectGen.current
      dispatch({
        type: 'SET_CONFIG',
        config: {
          startMode: 'resource',
          seedUri: uri,
          seedLabel: localName(uri),
        },
      })
      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: 'Building knowledge graph…',
      })
      try {
        const kg = await fetchEntityKnowledgeGraph(state.config.endpoint, uri)
        if (gen !== selectGen.current) return
        const stamped = stampInitialHopDepths(kg.nodes, uri)
        dispatch({
          type: 'RESET_GRAPH',
          graph: { nodes: stamped, links: kg.links },
          seedId: uri,
          panelMode: 'relations',
          message: kg.message,
          bumpEpoch: true,
        })
        dispatch({ type: 'SET_RELATIONS', relations: kg.relationTypes })
        dispatch({ type: 'SET_DATA_PROPERTIES', props: kg.dataProperties })
        dispatch({
          type: 'UPDATE_NODE_META',
          id: uri,
          classes: kg.classes,
          dataProperties: kg.dataProperties,
        })
        dispatch({ type: 'SET_PANEL', mode: 'relations' })
      } catch (err) {
        if (gen !== selectGen.current) return
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to open knowledge graph',
        })
      } finally {
        if (gen === selectGen.current) {
          dispatch({ type: 'SET_LOADING', loading: false })
        }
      }
    },
    [state.config.endpoint],
  )

  const clearGraph = useCallback(() => {
    dispatch({ type: 'CLEAR_GRAPH' })
  }, [])

  const bootstrap = useCallback(
    async (override?: Partial<OntologyConfig>) => {
      const config = { ...state.config, ...override }
      dispatch({ type: 'SET_CONFIG', config })

      if (config.startMode === 'classmap') {
        dispatch({
          type: 'SET_LOADING',
          loading: true,
          message: 'Loading ontology class map…',
        })
        try {
          // Show curated backbone immediately if network is slow
          const map = await fetchOntologyClassMap(config.endpoint)
          dispatch({
            type: 'RESET_GRAPH',
            graph: { nodes: map.nodes, links: map.links },
            seedId: map.rootId,
            panelMode: 'relations',
            bumpEpoch: true,
          })
          const relations = await fetchRelationTypes(config.endpoint, map.rootId)
          dispatch({ type: 'SET_RELATIONS', relations })
          dispatch({ type: 'SET_DATA_PROPERTIES', props: [] })
          dispatch({ type: 'SET_PANEL', mode: 'relations' })
        } catch (err) {
          dispatch({
            type: 'SET_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load class map',
          })
        } finally {
          dispatch({ type: 'SET_LOADING', loading: false })
        }
        return
      }

      if (!config.seedUri) {
        dispatch({ type: 'SET_ERROR', error: 'Enter a resource URI to explore.' })
        return
      }

      dispatch({ type: 'SET_LOADING', loading: true, message: 'Seeding knowledge graph…' })

      try {
        const seed = await fetchSeedNeighborhood(config.endpoint, config.seedUri)
        const seedNode: GraphNode = {
          id: config.seedUri,
          uri: config.seedUri,
          label: seed.label || config.seedLabel || localName(config.seedUri),
          type: isOntologyClassUri(config.seedUri) ? 'class' : 'resource',
          classes: seed.classes,
          __pulse: 1,
          __hopDepth: 0,
        }

        const nodes: GraphNode[] = [seedNode]
        const links: GraphLink[] = []
        const seen = new Set<string>([seedNode.id])

        for (const rel of seed.relations) {
          if (!seen.has(rel.target)) {
            seen.add(rel.target)
            nodes.push({
              id: rel.target,
              uri: rel.target,
              label: rel.targetLabel,
              type: isOntologyClassUri(rel.target) ? 'class' : 'resource',
              __hopDepth: 1,
            })
          }
          links.push({
            id: linkId(config.seedUri, rel.predicate, rel.target),
            source: config.seedUri,
            target: rel.target,
            predicate: rel.predicate,
            predicateLabel: rel.predicateLabel,
          })
        }

        dispatch({ type: 'RESET_GRAPH', graph: { nodes, links }, seedId: config.seedUri })

        const relations = await fetchRelationTypes(config.endpoint, config.seedUri)
        dispatch({ type: 'SET_RELATIONS', relations })

        const props = await fetchDataProperties(config.endpoint, config.seedUri)
        dispatch({ type: 'UPDATE_NODE_META', id: config.seedUri, dataProperties: props })
        dispatch({ type: 'SET_DATA_PROPERTIES', props })
        dispatch({ type: 'SET_PANEL', mode: 'relations' })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to load ontology',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [state.config],
  )

  const selectNode = useCallback(
    async (id: string) => {
      const gen = ++selectGen.current
      dispatch({ type: 'SELECT_NODE', id })

      // Multi-hop path from KG root → clicked node (concept breadcrumb)
      const root = state.pathRootId || state.config.seedUri || id
      const path = findShortestPath(state.graph, root, id)
      if (path && path.steps.length > 1) {
        dispatch({
          type: 'SET_PATH',
          steps: path.steps,
          nodeIds: path.steps.map((s) => s.nodeId),
          linkIds: path.linkIds,
        })
      } else {
        dispatch({ type: 'CLEAR_PATH' })
      }

      dispatch({ type: 'SET_LOADING', loading: true, message: 'Loading relations…' })
      try {
        const relations = await fetchRelationTypes(state.config.endpoint, id)
        if (gen !== selectGen.current) return
        dispatch({ type: 'SET_RELATIONS', relations })
        dispatch({ type: 'SET_LOADING', loading: false })
        dispatch({ type: 'SET_PANEL', mode: 'relations' })

        void Promise.all([
          fetchDataProperties(state.config.endpoint, id),
          fetchResourceClasses(state.config.endpoint, id),
        ]).then(([props, classes]) => {
          if (gen !== selectGen.current) return
          dispatch({ type: 'SET_DATA_PROPERTIES', props })
          dispatch({ type: 'UPDATE_NODE_META', id, classes, dataProperties: props })
        })
      } catch (err) {
        if (gen !== selectGen.current) return
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to load node',
        })
      }
    },
    [state.config.endpoint, state.config.seedUri, state.pathRootId, state.graph],
  )

  /** Primary UX: relation click → nodes + edges appear on the graph immediately. */
  const expandRelation = useCallback(
    async (relation: RelationType, limit = 8) => {
      if (!state.selectedNodeId) return
      const sourceId = state.selectedNodeId
      dispatch({ type: 'SET_ACTIVE_RELATION', relation })
      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Expanding ${relation.predicateLabel}…`,
      })
      try {
        const neighbors = await fetchConnectedNodes(
          state.config.endpoint,
          sourceId,
          relation.predicate,
          relation.direction,
          limit,
        )
        dispatch({ type: 'SET_NEIGHBORS', neighbors })

        const { nodes, links } = toGraphPieces(sourceId, relation, neighbors)
        const existing = new Set(state.graph.nodes.map((n) => n.id))
        const added = nodes.filter((n) => !existing.has(n.id)).length

        dispatch({
          type: 'ADD_NODES',
          nodes,
          links,
          message:
            added > 0
              ? `Added ${added} node${added === 1 ? '' : 's'} + edges via ${relation.predicateLabel}`
              : neighbors.length
                ? `All ${neighbors.length} neighbors already on the graph`
                : `No connected nodes for ${relation.predicateLabel}`,
        })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to expand relation',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [state.config.endpoint, state.selectedNodeId, state.graph.nodes],
  )

  /** Expand or shrink the graph to an absolute hop depth (1–3). Out / In / Both. */
  const applyHops = useCallback(
    async (targetHops: number, direction: HopDirection) => {
      const root = state.selectedNodeId || state.pathRootId
      if (!root || targetHops < 0) return

      const current = state.appliedHopDepth

      if (targetHops < current) {
        dispatch({
          type: 'TRIM_TO_HOPS',
          maxDepth: targetHops,
          message: `Trimmed to ${targetHops} hop${targetHops === 1 ? '' : 's'}`,
        })
        return
      }

      if (targetHops === current && current > 0) {
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Already at ${current} hop${current === 1 ? '' : 's'}`,
        })
        return
      }

      const startDepth = current
      const hopsToFetch = targetHops - startDepth
      if (hopsToFetch < 1 && targetHops > 0) {
        // current is 0 (seed only) — expand to target
      }

      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Growing to ${targetHops} hop${targetHops > 1 ? 's' : ''} (${direction})…`,
      })

      try {
        // Frontier = nodes at the current max depth (or root if none)
        let frontier: string[]
        if (startDepth === 0) {
          frontier = [root]
        } else {
          frontier = state.graph.nodes
            .filter((n) => (n.__hopDepth ?? 0) === startDepth)
            .map((n) => n.id)
          if (!frontier.length) frontier = [root]
        }

        const expandedFrom = new Set<string>()
        const known = new Set(state.graph.nodes.map((n) => n.id))
        let totalAdded = 0
        let totalEdges = 0
        const allNewLinkIds: string[] = []
        const pathNodes = new Set<string>([root])
        const absoluteStart = startDepth === 0 ? 1 : startDepth + 1

        for (let depth = absoluteStart; depth <= targetHops; depth++) {
          dispatch({
            type: 'SET_LOADING',
            loading: true,
            message: `Hop ${depth}/${targetHops} (${direction})…`,
          })

          const perNodeBudget = direction === 'both' ? 8 : 6
          const layer = await fetchHopLayer(state.config.endpoint, frontier, direction, {
            maxNodes: depth === 1 ? 1 : Math.min(10, frontier.length + 2),
            predsPerNode: direction === 'both' ? 4 : 5,
            neighborsPerPred: direction === 'both' ? 4 : 5,
          })

          // Cap layer size for readability
          const cappedNodes = layer.nodes.slice(0, direction === 'both' ? 36 : perNodeBudget * 4)
          const cappedIds = new Set(cappedNodes.map((n) => n.id))
          const cappedLinks = layer.links.filter((l) => {
            const s = typeof l.source === 'string' ? l.source : l.source.id
            const t = typeof l.target === 'string' ? l.target : l.target.id
            return (
              (cappedIds.has(s) || known.has(s) || frontier.includes(s)) &&
              (cappedIds.has(t) || known.has(t) || frontier.includes(t))
            )
          })

          const stamped = cappedNodes.map((n) => ({
            ...n,
            __hopDepth: n.__hopDepth ?? depth,
            __pulse: 1,
          }))

          let addedHere = 0
          for (const n of stamped) {
            if (!known.has(n.id)) {
              known.add(n.id)
              addedHere += 1
            }
            pathNodes.add(n.id)
          }
          totalAdded += addedHere
          totalEdges += cappedLinks.length
          for (const l of cappedLinks) allNewLinkIds.push(l.id)

          dispatch({
            type: 'ADD_NODES',
            nodes: stamped,
            links: cappedLinks,
            message: `Hop ${depth}: +${addedHere} · ${cappedLinks.length} edges (${direction})`,
          })

          dispatch({
            type: 'PUSH_HOP_TRAIL',
            step: {
              depth,
              fromIds: [...frontier],
              addedCount: addedHere,
              edgeCount: cappedLinks.length,
              sampleLabels: stamped.slice(0, 4).map((n) => n.label),
            },
          })

          for (const f of frontier) expandedFrom.add(f)

          const next: string[] = []
          const nextSeen = new Set<string>()
          for (const n of stamped) {
            if (expandedFrom.has(n.id) || nextSeen.has(n.id)) continue
            nextSeen.add(n.id)
            next.push(n.id)
          }
          frontier = next.slice(0, direction === 'both' ? 10 : 8)
          if (!frontier.length) break
        }

        dispatch({ type: 'SET_APPLIED_HOPS', depth: targetHops })
        dispatch({
          type: 'SET_PATH',
          steps: [],
          nodeIds: [...pathNodes],
          linkIds: allNewLinkIds.slice(0, 100),
        })
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `At ${targetHops} hop${targetHops > 1 ? 's' : ''} (${direction}) — +${totalAdded} nodes · ${totalEdges} edges`,
        })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Hop expand failed',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [
      state.selectedNodeId,
      state.pathRootId,
      state.appliedHopDepth,
      state.graph.nodes,
      state.config.endpoint,
    ],
  )

  const expandHops = useCallback(
    async (hops: number, direction: HopDirection) => {
      await applyHops(hops, direction)
    },
    [applyHops],
  )

  const shrinkHops = useCallback(
    (steps = 1) => {
      const next = Math.max(0, state.appliedHopDepth - steps)
      dispatch({
        type: 'TRIM_TO_HOPS',
        maxDepth: next,
        message: `Shrunk to ${next} hop${next === 1 ? '' : 's'}`,
      })
    },
    [state.appliedHopDepth],
  )

  const clearPath = useCallback(() => {
    dispatch({ type: 'CLEAR_PATH' })
  }, [])

  const openRelation = useCallback(
    async (relation: RelationType) => {
      if (!state.selectedNodeId) return
      dispatch({ type: 'SET_ACTIVE_RELATION', relation })
      dispatch({ type: 'SET_LOADING', loading: true, message: 'Fetching connected nodes…' })
      try {
        const neighbors = await fetchConnectedNodes(
          state.config.endpoint,
          state.selectedNodeId,
          relation.predicate,
          relation.direction,
          40,
        )
        dispatch({ type: 'SET_NEIGHBORS', neighbors })
        // Pre-select all so "Add selected" works immediately; user can uncheck
        dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: true })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to load neighbors',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [state.config.endpoint, state.selectedNodeId],
  )

  const toggleNeighbor = useCallback((uri: string) => {
    dispatch({ type: 'TOGGLE_NEIGHBOR', uri })
  }, [])

  const selectAllNeighbors = useCallback((selected: boolean) => {
    dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected })
  }, [])

  const addSelectedNeighbors = useCallback(() => {
    if (!state.selectedNodeId || !state.activeRelation) return
    const toAdd = state.neighbors.filter((n) => state.selectedNeighborUris.has(n.uri))
    if (!toAdd.length) return
    const { nodes, links } = toGraphPieces(
      state.selectedNodeId,
      state.activeRelation,
      toAdd,
    )
    dispatch({
      type: 'ADD_NODES',
      nodes,
      links,
      message: `Added ${toAdd.length} selected node${toAdd.length === 1 ? '' : 's'} with edges`,
    })
  }, [
    state.selectedNodeId,
    state.activeRelation,
    state.neighbors,
    state.selectedNeighborUris,
  ])

  const addAllNeighbors = useCallback(() => {
    if (!state.selectedNodeId || !state.activeRelation || !state.neighbors.length) return
    const { nodes, links } = toGraphPieces(
      state.selectedNodeId,
      state.activeRelation,
      state.neighbors,
    )
    dispatch({
      type: 'ADD_NODES',
      nodes,
      links,
      message: `Added all ${state.neighbors.length} connected node${state.neighbors.length === 1 ? '' : 's'}`,
    })
    dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: true })
  }, [state.selectedNodeId, state.activeRelation, state.neighbors])

  const addSingleNeighbor = useCallback(
    (neighbor: ConnectedNode) => {
      if (!state.selectedNodeId || !state.activeRelation) return
      const { nodes, links } = toGraphPieces(state.selectedNodeId, state.activeRelation, [
        neighbor,
      ])
      dispatch({
        type: 'ADD_NODES',
        nodes,
        links,
        message: `Linked “${neighbor.label}”`,
      })
    },
    [state.selectedNodeId, state.activeRelation],
  )

  const addSearchResult = useCallback(
    (node: ConnectedNode, linkToSelected = true) => {
      const nodes: GraphNode[] = [
        {
          id: node.uri,
          uri: node.uri,
          label: node.label,
          type: isOntologyClassUri(node.uri) ? 'class' : 'resource',
          classes: node.typeLabel ? [node.typeLabel] : undefined,
          __pulse: 1,
        },
      ]
      const links: GraphLink[] = []

      if (linkToSelected && state.selectedNodeId && state.selectedNodeId !== node.uri) {
        links.push({
          id: linkId(state.selectedNodeId, 'ontara:related', node.uri),
          source: state.selectedNodeId,
          target: node.uri,
          predicate: 'ontara:related',
          predicateLabel: 'related',
        })
      }

      dispatch({ type: 'ADD_NODES', nodes, links, message: `Added “${node.label}”` })
    },
    [state.selectedNodeId],
  )

  const showDetails = useCallback(() => {
    dispatch({ type: 'SET_PANEL', mode: 'details' })
  }, [])

  const showRelations = useCallback(() => {
    dispatch({ type: 'SET_PANEL', mode: 'relations' })
  }, [])

  const showSearch = useCallback(() => {
    dispatch({ type: 'SET_PANEL', mode: 'search' })
  }, [])

  const setConfig = useCallback((config: Partial<OntologyConfig>) => {
    dispatch({ type: 'SET_CONFIG', config })
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', error: null })
  }, [])

  const clearExpandMessage = useCallback(() => {
    dispatch({ type: 'CLEAR_EXPAND_MESSAGE' })
  }, [])

  return {
    ...state,
    selectedNode,
    openKnowledgeGraph,
    clearGraph,
    bootstrap,
    selectNode,
    expandRelation,
    expandHops,
    shrinkHops,
    applyHops,
    clearPath,
    openRelation,
    toggleNeighbor,
    selectAllNeighbors,
    addSelectedNeighbors,
    addAllNeighbors,
    addSingleNeighbor,
    addSearchResult,
    showDetails,
    showRelations,
    showSearch,
    setConfig,
    clearError,
    clearExpandMessage,
  }
}

export type OntologyStore = ReturnType<typeof useOntologyStore>
