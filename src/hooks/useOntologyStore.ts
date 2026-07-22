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
  fetchOntologyClassMap,
  fetchRelationTypes,
  fetchResourceClasses,
  fetchSeedNeighborhood,
  isOntologyClassUri,
  localName,
  type HopDirection,
} from '../services/sparql'
import {
  buildRelationHubs,
  expandOntologyHop3,
  expandRelationHubValues,
  fetchOntologyKnowledgeGraph,
  isRelationHubId,
} from '../services/ontologyHops'
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
    if (n.__hopDepth != null) return n
    if (n.id === rootId) return { ...n, __hopDepth: 0 }
    if (n.type === 'relation') return { ...n, __hopDepth: 1 }
    if (n.type === 'literal') return { ...n, __hopDepth: 2 }
    return { ...n, __hopDepth: n.__hopDepth ?? 2 }
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
        const kg = await fetchOntologyKnowledgeGraph(state.config.endpoint, uri, 'out')
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
        dispatch({ type: 'SET_APPLIED_HOPS', depth: kg.appliedHopDepth })
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
      const root = state.pathRootId || state.config.seedUri || id
      const path = findShortestPath(state.graph, root, id)
      const setPath = () => {
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
      }

      if (isRelationHubId(id) || id.startsWith('literal:')) {
        dispatch({ type: 'SELECT_NODE', id })
        setPath()
        dispatch({ type: 'SET_PANEL', mode: 'relations' })
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: isRelationHubId(id)
            ? 'Ontology property · Entity → Property → Value'
            : 'Literal data value',
        })
        return
      }

      const gen = ++selectGen.current
      dispatch({ type: 'SELECT_NODE', id })
      setPath()

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

        // Ontology-shaped: Entity → Property hub → Values
        if (isRelationHubId(sourceId)) {
          const hub = state.graph.nodes.find((n) => n.id === sourceId)
          const { nodes, links } = toGraphPieces(
            hub?.__parentId || sourceId,
            relation,
            neighbors,
          )
          // Rewire through the hub
          const viaHub = neighbors.map((n) => ({
            id: n.uri,
            uri: n.uri,
            label: n.label,
            type: isOntologyClassUri(n.uri) ? ('class' as const) : ('resource' as const),
            classes: n.typeLabel ? [n.typeLabel] : undefined,
            __hopDepth: 2,
            __clusterKey: sourceId,
            __parentId: sourceId,
            __predicate: relation.predicate,
            __pulse: 1,
          }))
          const viaLinks = neighbors.map((n) => ({
            id: `${sourceId}|${relation.predicate}|${n.uri}`,
            source: sourceId,
            target: n.uri,
            predicate: relation.predicate,
            predicateLabel: relation.predicateLabel.replace(/\s*\(.*\)$/, ''),
          }))
          void nodes
          void links
          const existing = new Set(state.graph.nodes.map((n) => n.id))
          const added = viaHub.filter((n) => !existing.has(n.id)).length
          dispatch({
            type: 'ADD_NODES',
            nodes: viaHub,
            links: viaLinks,
            message:
              added > 0
                ? `Added ${added} values under ${relation.predicateLabel}`
                : `Values already on the graph`,
          })
        } else {
          const hubId = `relhub:${relation.direction}:${relation.predicate}:${sourceId}`
          const hubLabel = relation.predicateLabel.replace(/\s*\(.*\)$/, '')
          const hubNode: GraphNode = {
            id: hubId,
            uri: relation.predicate,
            label: hubLabel,
            type: 'relation',
            classes: ['Ontology property'],
            __hopDepth: 1,
            __clusterKey: hubId,
            __parentId: sourceId,
            __predicate: relation.predicate,
            __direction: relation.direction,
            __pulse: 1,
          }
          const valueNodes: GraphNode[] = neighbors.map((n) => ({
            id: n.uri,
            uri: n.uri,
            label: n.label,
            type: isOntologyClassUri(n.uri) ? ('class' as const) : ('resource' as const),
            classes: n.typeLabel ? [n.typeLabel] : undefined,
            __hopDepth: 2,
            __clusterKey: hubId,
            __parentId: hubId,
            __predicate: relation.predicate,
            __pulse: 1,
          }))
          const links: GraphLink[] = [
            {
              id: `${sourceId}|${relation.predicate}|${hubId}`,
              source: sourceId,
              target: hubId,
              predicate: relation.predicate,
              predicateLabel: hubLabel,
            },
            ...neighbors.map((n) => ({
              id: `${hubId}|${relation.predicate}|${n.uri}`,
              source: hubId,
              target: n.uri,
              predicate: relation.predicate,
              predicateLabel: hubLabel,
            })),
          ]
          const existing = new Set(state.graph.nodes.map((n) => n.id))
          const toAdd = [hubNode, ...valueNodes].filter((n) => !existing.has(n.id))
          dispatch({
            type: 'ADD_NODES',
            nodes: toAdd,
            links,
            message: `Ontology: ${hubLabel} → ${neighbors.length} value${neighbors.length === 1 ? '' : 's'}`,
          })
          if (state.appliedHopDepth < 2) {
            dispatch({ type: 'SET_APPLIED_HOPS', depth: 2 })
          }
        }
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

  /** Ontology hops: 1 = property hubs, 2 = values, 3 = next entity→property→value layer. */
  const applyHops = useCallback(
    async (targetHops: number, direction: HopDirection) => {
      const root = state.pathRootId || state.selectedNodeId
      if (!root || targetHops < 0) return
      if (isRelationHubId(root) || root.startsWith('literal:')) return

      const current = state.appliedHopDepth

      if (targetHops < current) {
        dispatch({
          type: 'TRIM_TO_HOPS',
          maxDepth: targetHops,
          message:
            targetHops === 0
              ? 'Seed entity only'
              : targetHops === 1
                ? 'Ontology properties (hop 1)'
                : `Trimmed to ontology hop ${targetHops}`,
        })
        return
      }

      if (targetHops === current && current > 0) {
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Already at ontology hop ${current}`,
        })
        return
      }

      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Ontology hop → ${targetHops} (${direction})…`,
      })

      try {
        // Local snapshot — React state won't update mid-loop
        let localNodes: GraphNode[] = [...state.graph.nodes]
        const known = new Set(localNodes.map((n) => n.id))
        let totalAdded = 0
        let totalEdges = 0
        const pathNodes = new Set<string>([root])
        const allNewLinkIds: string[] = []

        for (let depth = current + 1; depth <= targetHops; depth++) {
          dispatch({
            type: 'SET_LOADING',
            loading: true,
            message:
              depth === 1
                ? 'Hop 1 · ontology properties…'
                : depth === 2
                  ? 'Hop 2 · property values…'
                  : 'Hop 3 · next ontology layer…',
          })

          let layerNodes: GraphNode[] = []
          let layerLinks: GraphLink[] = []

          if (depth === 1) {
            const types = await fetchRelationTypes(state.config.endpoint, root)
            const hubs = buildRelationHubs(root, types, direction, direction === 'both' ? 12 : 10)
            layerNodes = hubs.nodes
            layerLinks = hubs.links
          } else if (depth === 2) {
            const hubs = localNodes.filter(
              (n) => n.type === 'relation' && (n.__hopDepth ?? 0) === 1 && n.__parentId,
            )
            const vals = await expandRelationHubValues(
              state.config.endpoint,
              hubs,
              direction === 'both' ? 4 : 5,
            )
            layerNodes = vals.nodes
            layerLinks = vals.links
          } else if (depth === 3) {
            const values = localNodes.filter(
              (n) =>
                (n.__hopDepth ?? 0) === 2 &&
                (n.type === 'resource' || n.type === 'class') &&
                !isRelationHubId(n.id),
            )
            const layer = await expandOntologyHop3(state.config.endpoint, values, direction, {
              maxSubjects: 5,
              hubsPerSubject: 2,
              valuesPerHub: 2,
            })
            layerNodes = layer.nodes
            layerLinks = layer.links
          }

          const stamped = layerNodes.map((n) => ({
            ...n,
            __hopDepth: n.__hopDepth ?? depth,
            __pulse: 1,
          }))

          let addedHere = 0
          for (const n of stamped) {
            if (!known.has(n.id)) {
              known.add(n.id)
              localNodes.push(n)
              addedHere += 1
            }
            pathNodes.add(n.id)
          }
          totalAdded += addedHere
          totalEdges += layerLinks.length
          for (const l of layerLinks) allNewLinkIds.push(l.id)

          dispatch({
            type: 'ADD_NODES',
            nodes: stamped,
            links: layerLinks,
            message:
              depth === 1
                ? `Hop 1 · +${addedHere} ontology properties`
                : depth === 2
                  ? `Hop 2 · +${addedHere} values`
                  : `Hop 3 · +${addedHere} ontology links`,
          })

          dispatch({
            type: 'PUSH_HOP_TRAIL',
            step: {
              depth,
              fromIds: [root],
              addedCount: addedHere,
              edgeCount: layerLinks.length,
              sampleLabels: stamped.slice(0, 4).map((n) => n.label),
            },
          })
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
          message: `Ontology hop ${targetHops} · +${totalAdded} · ${totalEdges} edges`,
        })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Ontology hop failed',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [
      state.pathRootId,
      state.selectedNodeId,
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
