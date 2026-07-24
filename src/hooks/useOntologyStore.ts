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
  expandEntityHopLayer,
  expandKnowledgeFacet,
  fetchOntologyKnowledgeGraph,
  graphPiecesViaHub,
  isRelationHubId,
  MAX_ONTOLOGY_HOPS,
  type EntityKind,
} from '../services/ontologyHops'
import type { FacetId } from '../types/facets'
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
  /** Curated dossier kind for facet bar (person / org). */
  entityKind: EntityKind
  /** Facets already expanded this session (for chip active state). */
  expandedFacets: FacetId[]
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
  | { type: 'SET_ENTITY_KIND'; kind: EntityKind }
  | { type: 'MARK_FACET'; facetId: FacetId }
  | { type: 'CLEAR_FACETS' }

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
  entityKind: 'other',
  expandedFacets: [],
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
        expandedFacets: [],
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
        entityKind: 'other',
        expandedFacets: [],
      }
    case 'SELECT_NODE':
      return {
        ...state,
        selectedNodeId: action.id,
        activeRelation: null,
        relationTypes: [],
        neighbors: [],
        selectedNeighborUris: new Set(),
        dataProperties: [],
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
    case 'SET_ENTITY_KIND':
      return { ...state, entityKind: action.kind }
    case 'MARK_FACET':
      return {
        ...state,
        expandedFacets: state.expandedFacets.includes(action.facetId)
          ? state.expandedFacets
          : [...state.expandedFacets, action.facetId],
      }
    case 'CLEAR_FACETS':
      return { ...state, expandedFacets: [], entityKind: 'other' }
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
        dispatch({ type: 'SET_ENTITY_KIND', kind: kg.entityKind })
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

      const gen = ++selectGen.current
      dispatch({ type: 'SELECT_NODE', id })
      setPath()

      if (id.startsWith('literal:')) {
        dispatch({ type: 'SET_PANEL', mode: 'details' })
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: 'Literal data value',
        })
        return
      }

      // Property hub → load connected values for add single / multi / all
      if (isRelationHubId(id)) {
        const hub = state.graph.nodes.find((n) => n.id === id)
        const parentId = hub?.__parentId
        const predicate = hub?.__predicate || hub?.uri
        const direction = (hub?.__direction === 'in' ? 'in' : 'out') as 'out' | 'in'
        if (!parentId || !predicate) {
          dispatch({ type: 'SET_PANEL', mode: 'relations' })
          dispatch({
            type: 'ADD_NODES',
            nodes: [],
            links: [],
            message: 'Ontology property · Entity → Property → Value',
          })
          return
        }

        const relation: RelationType = {
          predicate,
          predicateLabel: hub?.label || localName(predicate),
          count: -1,
          direction,
        }
        dispatch({ type: 'SET_ACTIVE_RELATION', relation })
        dispatch({ type: 'SET_RELATIONS', relations: [relation] })
        dispatch({
          type: 'SET_LOADING',
          loading: true,
          message: `Listing ${relation.predicateLabel}…`,
        })
        try {
          const neighbors = await fetchConnectedNodes(
            state.config.endpoint,
            parentId,
            predicate,
            direction,
            40,
          )
          if (gen !== selectGen.current) return
          dispatch({ type: 'SET_NEIGHBORS', neighbors })
          dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: true })
          dispatch({ type: 'SET_PANEL', mode: 'neighbors' })
          dispatch({
            type: 'ADD_NODES',
            nodes: [],
            links: [],
            message: `${neighbors.length} connected · add one, selected, or all`,
          })
        } catch (err) {
          if (gen !== selectGen.current) return
          dispatch({
            type: 'SET_ERROR',
            error: err instanceof Error ? err.message : 'Failed to load property values',
          })
        } finally {
          if (gen === selectGen.current) dispatch({ type: 'SET_LOADING', loading: false })
        }
        return
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

  /** Resolve which entity owns a relation expand (hub → parent entity). */
  const expandSubjectId = useCallback((): string | null => {
    const id = state.selectedNodeId
    if (!id || id.startsWith('literal:')) return null
    if (isRelationHubId(id)) {
      return state.graph.nodes.find((n) => n.id === id)?.__parentId ?? null
    }
    return id
  }, [state.selectedNodeId, state.graph.nodes])

  /** Primary UX: relation click → Entity → Property hub → Values on the graph. */
  const expandRelation = useCallback(
    async (relation: RelationType, limit = 8) => {
      const sourceId = expandSubjectId()
      if (!sourceId) return
      const hopDepth = Math.min(
        MAX_ONTOLOGY_HOPS,
        Math.max(1, (state.graph.nodes.find((n) => n.id === sourceId)?.__hopDepth ?? 0) + 1),
      )
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
        dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: true })

        const { nodes, links } = graphPiecesViaHub(sourceId, relation, neighbors, hopDepth)
        const existing = new Set(state.graph.nodes.map((n) => n.id))
        const added = nodes.filter((n) => !existing.has(n.id)).length
        dispatch({
          type: 'ADD_NODES',
          nodes,
          links,
          message:
            added > 0
              ? `Added ${added} under ${relation.predicateLabel}`
              : `Already on the graph`,
        })
        if (state.appliedHopDepth < hopDepth) {
          dispatch({ type: 'SET_APPLIED_HOPS', depth: hopDepth })
        }
        dispatch({ type: 'SET_PANEL', mode: 'neighbors' })
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Failed to expand relation',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [
      expandSubjectId,
      state.config.endpoint,
      state.graph.nodes,
      state.appliedHopDepth,
    ],
  )

  /**
   * Entity-distance hops from the seed (path root).
   * Out / In / Both filter which SPARQL directions to follow.
   * Each hop = property hubs + value entities for the frontier.
   * Caps at MAX_ONTOLOGY_HOPS; stops early when no new entities appear.
   */
  const applyHops = useCallback(
    async (targetHops: number, direction: HopDirection) => {
      const root = state.pathRootId || state.selectedNodeId
      if (!root || targetHops < 0) return
      if (isRelationHubId(root) || root.startsWith('literal:')) return

      const capped = Math.min(MAX_ONTOLOGY_HOPS, Math.max(0, targetHops))
      const current = state.appliedHopDepth

      if (capped < current) {
        dispatch({
          type: 'TRIM_TO_HOPS',
          maxDepth: capped,
          message:
            capped === 0
              ? 'Seed entity only'
              : `Trimmed to hop ${capped}`,
        })
        return
      }

      if (capped === current && current > 0) {
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Already at hop ${current}`,
        })
        return
      }

      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Hop → ${capped} (${direction})…`,
      })

      try {
        let localNodes: GraphNode[] = [...state.graph.nodes]
        const known = new Set(localNodes.map((n) => n.id))
        const visited = new Set<string>([root])
        let totalAdded = 0
        let totalEdges = 0
        let reached = current

        const entityFrontier = (depth: number): string[] => {
          if (depth <= 0) return [root]
          return localNodes
            .filter(
              (n) =>
                (n.__hopDepth ?? 0) === depth &&
                (n.type === 'resource' || n.type === 'class') &&
                !isRelationHubId(n.id) &&
                !n.id.startsWith('literal:'),
            )
            .map((n) => n.id)
        }

        for (let depth = current + 1; depth <= capped; depth++) {
          const layerSubjects =
            depth === 1 ? [root] : entityFrontier(depth - 1).slice(0, 8)

          if (!layerSubjects.length) {
            dispatch({
              type: 'ADD_NODES',
              nodes: [],
              links: [],
              message: `No more data past hop ${reached} (${direction})`,
            })
            break
          }

          dispatch({
            type: 'SET_LOADING',
            loading: true,
            message: `Hop ${depth} · ${direction} from ${layerSubjects.length} entit${layerSubjects.length === 1 ? 'y' : 'ies'}…`,
          })

          const layer = await expandEntityHopLayer(
            state.config.endpoint,
            layerSubjects,
            direction,
            depth,
            {
              maxSubjects: depth === 1 ? 1 : 6,
              predsPerSubject: direction === 'both' ? 3 : 4,
              neighborsPerPred: depth === 1 ? 5 : 3,
            },
          )

          const stamped = layer.nodes.map((n) => ({
            ...n,
            __hopDepth: depth,
            __pulse: 1,
          }))

          let addedHere = 0
          for (const n of stamped) {
            if (!known.has(n.id)) {
              known.add(n.id)
              localNodes.push(n)
              addedHere += 1
            }
          }
          const unseenFrontier = layer.nextFrontier.filter((id) => !visited.has(id))
          for (const id of layerSubjects) visited.add(id)
          for (const id of layer.nextFrontier) visited.add(id)
          totalAdded += addedHere
          totalEdges += layer.links.length

          dispatch({
            type: 'ADD_NODES',
            nodes: stamped,
            links: layer.links,
            message: `Hop ${depth} · +${addedHere} nodes`,
          })

          dispatch({
            type: 'PUSH_HOP_TRAIL',
            step: {
              depth,
              fromIds: layerSubjects,
              addedCount: addedHere,
              edgeCount: layer.links.length,
              sampleLabels: stamped.slice(0, 4).map((n) => n.label),
            },
          })

          reached = depth

          if (layer.exhausted || (addedHere === 0 && unseenFrontier.length === 0)) {
            dispatch({
              type: 'ADD_NODES',
              nodes: [],
              links: [],
              message:
                depth < capped
                  ? `Stopped at hop ${depth} — no further ${direction} data`
                  : `Hop ${depth} complete`,
            })
            break
          }
        }

        dispatch({ type: 'SET_APPLIED_HOPS', depth: reached })
        dispatch({ type: 'CLEAR_PATH' })
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Hops ${reached} · +${totalAdded} · ${totalEdges} edges · ${direction}`,
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
      state.pathRootId,
      state.selectedNodeId,
      state.appliedHopDepth,
      state.graph.nodes,
      state.config.endpoint,
    ],
  )

  /**
   * Expand the selected entity onto the canvas.
   * steps = how many entity-distance hops from this node (1–3)
   * all = pull more properties + more values per property (“see everything attached”)
   */
  const expandNode = useCallback(
    async (
      direction: HopDirection = 'both',
      opts?: { steps?: number; all?: boolean; nodeId?: string },
    ) => {
      const id = opts?.nodeId ?? state.selectedNodeId
      if (!id || isRelationHubId(id) || id.startsWith('literal:')) return

      const steps = Math.min(3, Math.max(1, opts?.steps ?? 1))
      const all = opts?.all ?? false
      const fromDepth = state.graph.nodes.find((n) => n.id === id)?.__hopDepth ?? 0

      if (fromDepth + 1 > MAX_ONTOLOGY_HOPS) {
        dispatch({
          type: 'ADD_NODES',
          nodes: [],
          links: [],
          message: `Max ${MAX_ONTOLOGY_HOPS} hops reached`,
        })
        return
      }

      // Keep inspector on this node while expanding
      if (state.selectedNodeId !== id) {
        dispatch({ type: 'SELECT_NODE', id })
        dispatch({ type: 'SET_PANEL', mode: 'relations' })
        void fetchRelationTypes(state.config.endpoint, id).then((relations) => {
          dispatch({ type: 'SET_RELATIONS', relations })
        })
      }

      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: all
          ? `Loading all attached (${direction})…`
          : `Next hop ×${steps} (${direction})…`,
      })

      try {
        let localNodes: GraphNode[] = [...state.graph.nodes]
        const known = new Set(localNodes.map((n) => n.id))
        let frontier = [id]
        let totalAdded = 0
        let lastDepth = fromDepth

        for (let s = 1; s <= steps; s++) {
          const depth = fromDepth + s
          if (depth > MAX_ONTOLOGY_HOPS) break

          const layer = await expandEntityHopLayer(
            state.config.endpoint,
            frontier,
            direction,
            depth,
            {
              maxSubjects: s === 1 ? 1 : all ? 8 : 4,
              predsPerSubject: all
                ? direction === 'both'
                  ? 14
                  : 18
                : direction === 'both'
                  ? 5
                  : 7,
              neighborsPerPred: all ? 24 : 6,
            },
          )

          const stamped = layer.nodes.map((n) => ({
            ...n,
            __hopDepth: depth,
            __pulse: 1,
          }))

          let addedHere = 0
          for (const n of stamped) {
            if (!known.has(n.id)) {
              known.add(n.id)
              localNodes.push(n)
              addedHere += 1
            }
          }
          totalAdded += addedHere
          lastDepth = depth

          dispatch({
            type: 'ADD_NODES',
            nodes: stamped,
            links: layer.links,
            message: `Depth +${s} · +${addedHere}`,
          })

          if (layer.exhausted || addedHere === 0) {
            if (s === 1 && addedHere === 0) {
              dispatch({
                type: 'ADD_NODES',
                nodes: [],
                links: [],
                message: layer.exhausted
                  ? `No further ${direction} links on this node`
                  : `Neighbors already on graph`,
              })
            }
            break
          }

          frontier = layer.nextFrontier
            .filter((fid) => fid !== id)
            .slice(0, all ? 10 : 6)
          if (!frontier.length) break
        }

        if (totalAdded > 0 && state.appliedHopDepth < lastDepth) {
          dispatch({ type: 'SET_APPLIED_HOPS', depth: lastDepth })
        }
        dispatch({ type: 'CLEAR_PATH' })
        if (totalAdded > 0) {
          dispatch({
            type: 'ADD_NODES',
            nodes: [],
            links: [],
            message: all
              ? `All attached · +${totalAdded} · ${direction}`
              : `Next ${steps} hop${steps === 1 ? '' : 's'} · +${totalAdded} · ${direction}`,
          })
        }
      } catch (err) {
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Expand node failed',
        })
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false })
      }
    },
    [
      state.selectedNodeId,
      state.graph.nodes,
      state.config.endpoint,
      state.appliedHopDepth,
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
      const sourceId = expandSubjectId()
      if (!sourceId) return
      dispatch({ type: 'SET_ACTIVE_RELATION', relation })
      dispatch({ type: 'SET_LOADING', loading: true, message: 'Fetching connected nodes…' })
      try {
        const neighbors = await fetchConnectedNodes(
          state.config.endpoint,
          sourceId,
          relation.predicate,
          relation.direction,
          40,
        )
        dispatch({ type: 'SET_NEIGHBORS', neighbors })
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
    [state.config.endpoint, expandSubjectId],
  )

  const toggleNeighbor = useCallback((uri: string) => {
    dispatch({ type: 'TOGGLE_NEIGHBOR', uri })
  }, [])

  const selectAllNeighbors = useCallback((selected: boolean) => {
    dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected })
  }, [])

  const addViaActiveRelation = useCallback(
    (items: ConnectedNode[], message: string) => {
      const sourceId = expandSubjectId()
      if (!sourceId || !state.activeRelation || !items.length) return
      const hopDepth = Math.min(
        MAX_ONTOLOGY_HOPS,
        Math.max(1, (state.graph.nodes.find((n) => n.id === sourceId)?.__hopDepth ?? 0) + 1),
      )
      const { nodes, links } = graphPiecesViaHub(
        sourceId,
        state.activeRelation,
        items,
        hopDepth,
      )
      dispatch({ type: 'ADD_NODES', nodes, links, message })
      if (state.appliedHopDepth < hopDepth) {
        dispatch({ type: 'SET_APPLIED_HOPS', depth: hopDepth })
      }
    },
    [
      expandSubjectId,
      state.activeRelation,
      state.graph.nodes,
      state.appliedHopDepth,
    ],
  )

  const addSelectedNeighbors = useCallback(() => {
    const toAdd = state.neighbors.filter((n) => state.selectedNeighborUris.has(n.uri))
    if (!toAdd.length) return
    addViaActiveRelation(
      toAdd,
      `Added ${toAdd.length} selected node${toAdd.length === 1 ? '' : 's'}`,
    )
  }, [state.neighbors, state.selectedNeighborUris, addViaActiveRelation])

  const addAllNeighbors = useCallback(() => {
    if (!state.neighbors.length) return
    addViaActiveRelation(
      state.neighbors,
      `Added all ${state.neighbors.length} connected node${state.neighbors.length === 1 ? '' : 's'}`,
    )
    dispatch({ type: 'SELECT_ALL_NEIGHBORS', selected: true })
  }, [state.neighbors, addViaActiveRelation])

  const addSingleNeighbor = useCallback(
    (neighbor: ConnectedNode) => {
      addViaActiveRelation([neighbor], `Linked “${neighbor.label}”`)
    },
    [addViaActiveRelation],
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

  const expandFacet = useCallback(
    async (facetId: FacetId) => {
      const subject = state.pathRootId || state.config.seedUri
      if (!subject) return
      const gen = ++selectGen.current
      dispatch({
        type: 'SET_LOADING',
        loading: true,
        message: `Expanding ${facetId}…`,
      })
      try {
        const { nodes, links, message } = await expandKnowledgeFacet(
          state.config.endpoint,
          subject,
          facetId,
        )
        if (gen !== selectGen.current) return
        if (nodes.length) {
          dispatch({ type: 'ADD_NODES', nodes, links, message })
        } else {
          dispatch({ type: 'SET_LOADING', loading: false, message: '' })
          // still show message via lastExpand
          dispatch({
            type: 'ADD_NODES',
            nodes: [],
            links: [],
            message,
          })
        }
        dispatch({ type: 'MARK_FACET', facetId })
      } catch (err) {
        if (gen !== selectGen.current) return
        dispatch({
          type: 'SET_ERROR',
          error: err instanceof Error ? err.message : 'Facet expand failed',
        })
      } finally {
        if (gen === selectGen.current) {
          dispatch({ type: 'SET_LOADING', loading: false })
        }
      }
    },
    [state.pathRootId, state.config.seedUri, state.config.endpoint],
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
    expandNode,
    expandFacet,
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
