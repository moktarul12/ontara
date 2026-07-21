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

type PanelMode = 'idle' | 'relations' | 'neighbors' | 'details' | 'search'

interface ExploreState {
  config: OntologyConfig
  graph: GraphData
  selectedNodeId: string | null
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

const initialState: ExploreState = {
  config: { ...DEFAULT_CONFIG },
  graph: { nodes: [], links: [] },
  selectedNodeId: null,
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
        activeRelation: null,
        relationTypes: [],
        neighbors: [],
        selectedNeighborUris: new Set(),
        dataProperties: [],
        panelMode: action.panelMode ?? 'relations',
        highlightedLinkId: null,
        lastExpandMessage: action.message ?? null,
        graphEpoch: action.bumpEpoch === false ? state.graphEpoch : state.graphEpoch + 1,
      }
    case 'CLEAR_GRAPH':
      return {
        ...state,
        graph: { nodes: [], links: [] },
        selectedNodeId: null,
        activeRelation: null,
        relationTypes: [],
        neighbors: [],
        selectedNeighborUris: new Set(),
        dataProperties: [],
        panelMode: 'idle',
        highlightedLinkId: null,
        lastExpandMessage: null,
        graphEpoch: state.graphEpoch + 1,
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
    default:
      return state
  }
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
        dispatch({
          type: 'RESET_GRAPH',
          graph: { nodes: kg.nodes, links: kg.links },
          seedId: uri,
          panelMode: 'details',
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
        // Keep details as the primary panel after relations load
        dispatch({ type: 'SET_PANEL', mode: 'details' })
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
      dispatch({ type: 'SET_LOADING', loading: true, message: 'Loading relations…' })
      try {
        // Relations first — unblocks the expand UI quickly
        const relations = await fetchRelationTypes(state.config.endpoint, id)
        if (gen !== selectGen.current) return
        dispatch({ type: 'SET_RELATIONS', relations })
        dispatch({ type: 'SET_LOADING', loading: false })
        dispatch({ type: 'SET_PANEL', mode: 'relations' })

        // Details in background
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
    [state.config.endpoint],
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

  /** Family-tree style: expand N hops in/out/both from the selected node. */
  const expandHops = useCallback(
    async (hops: number, direction: HopDirection) => {
      if (!state.selectedNodeId || hops < 1) return
      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Expanding ${hops} hop${hops > 1 ? 's' : ''} (${direction})…`,
      })

      try {
        let frontier = [state.selectedNodeId]
        const seen = new Set(state.graph.nodes.map((n) => n.id))
        let totalAdded = 0
        let totalEdges = 0

        for (let depth = 1; depth <= hops; depth++) {
          dispatch({
            type: 'SET_LOADING',
            loading: true,
            message: `Hop ${depth}/${hops} (${direction})…`,
          })
          const layer = await fetchHopLayer(state.config.endpoint, frontier, direction, {
            maxNodes: depth === 1 ? 1 : 8,
            predsPerNode: 4,
            neighborsPerPred: 3,
          })

          const newNodes = layer.nodes.filter((n) => !seen.has(n.id))
          for (const n of newNodes) seen.add(n.id)
          totalAdded += newNodes.length
          totalEdges += layer.links.length

          dispatch({
            type: 'ADD_NODES',
            nodes: layer.nodes,
            links: layer.links,
            message: `Hop ${depth}: +${newNodes.length} nodes`,
          })

          frontier = layer.nodes.map((n) => n.id).filter((id) => id !== state.selectedNodeId)
          if (!frontier.length) break
        }

        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Expanded ${hops} hop${hops > 1 ? 's' : ''} (${direction}) — +${totalAdded} nodes, ${totalEdges} edges`,
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
    [state.config.endpoint, state.selectedNodeId, state.graph.nodes],
  )

  const openRelation = useCallback(
    async (relation: RelationType) => {
      // Browse-only path (list without auto-add)
      if (!state.selectedNodeId) return
      dispatch({ type: 'SET_ACTIVE_RELATION', relation })
      dispatch({ type: 'SET_LOADING', loading: true, message: 'Fetching connected nodes…' })
      try {
        const neighbors = await fetchConnectedNodes(
          state.config.endpoint,
          state.selectedNodeId,
          relation.predicate,
          relation.direction,
          20,
        )
        dispatch({ type: 'SET_NEIGHBORS', neighbors })
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
    dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: false })
  }, [
    state.selectedNodeId,
    state.activeRelation,
    state.neighbors,
    state.selectedNeighborUris,
  ])

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
    openRelation,
    toggleNeighbor,
    selectAllNeighbors,
    addSelectedNeighbors,
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
