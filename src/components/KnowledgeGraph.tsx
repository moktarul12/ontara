import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { GraphData, GraphLink, GraphNode } from '../types/ontology'

interface Props {
  data: GraphData
  selectedNodeId: string | null
  highlightedLinkId: string | null
  graphEpoch?: number
  onNodeClick: (node: GraphNode) => void
  onBackgroundClick?: () => void
}

const COLORS = {
  node: '#3ddc97',
  nodeClass: '#7eb8da',
  nodeSelected: '#f0c75e',
  link: 'rgba(126, 184, 218, 0.45)',
  linkHot: 'rgba(240, 199, 94, 0.9)',
  label: '#e8f1f0',
}

function nodeId(n: string | GraphNode): string {
  return typeof n === 'string' ? n : n.id
}

type FGInstance = {
  d3Force: (name: string, force?: unknown) => unknown
  d3ReheatSimulation: () => void
  centerAt: (x?: number, y?: number, ms?: number) => void
  zoom: (scale?: number, ms?: number) => void
  zoomToFit: (ms?: number, padding?: number) => void
}

function pinNode(node: GraphNode) {
  if (typeof node.x === 'number') node.fx = node.x
  if (typeof node.y === 'number') node.fy = node.y
}

function unpinNode(node: GraphNode) {
  node.fx = undefined
  node.fy = undefined
}

export function KnowledgeGraph({
  data,
  selectedNodeId,
  highlightedLinkId,
  graphEpoch = 0,
  onNodeClick,
  onBackgroundClick,
}: Props) {
  const fgRef = useRef<FGInstance | undefined>(undefined)
  const wrapRef = useRef<HTMLDivElement>(null)
  const nodeStore = useRef(new Map<string, GraphNode>())
  const linkStore = useRef(new Map<string, GraphLink>())
  const prevSelected = useRef<string | null>(null)
  const prevEpoch = useRef(graphEpoch)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const dragging = useRef(false)

  const graphData = useMemo(() => {
    if (prevEpoch.current !== graphEpoch) {
      prevEpoch.current = graphEpoch
      nodeStore.current.clear()
      linkStore.current.clear()
      prevSelected.current = null
    }

    const nextNodeIds = new Set(data.nodes.map((n) => n.id))
    for (const id of [...nodeStore.current.keys()]) {
      if (!nextNodeIds.has(id)) nodeStore.current.delete(id)
    }

    const center = selectedNodeId
      ? nodeStore.current.get(selectedNodeId)
      : undefined
    let spawnIndex = 0

    for (const n of data.nodes) {
      const existing = nodeStore.current.get(n.id)
      if (existing) {
        existing.label = n.label
        existing.type = n.type
        existing.classes = n.classes
        existing.__pulse = n.__pulse
      } else {
        const isCenter = n.id === selectedNodeId || data.nodes.length === 1
        const angle = (spawnIndex / Math.max(data.nodes.length - 1, 1)) * Math.PI * 2
        spawnIndex += 1
        const radius = isCenter ? 0 : 90 + (spawnIndex % 5) * 18
        const baseX = center?.x ?? 0
        const baseY = center?.y ?? 0
        nodeStore.current.set(n.id, {
          ...n,
          x: isCenter ? baseX : baseX + Math.cos(angle) * radius,
          y: isCenter ? baseY : baseY + Math.sin(angle) * radius,
        })
      }
    }

    const nextLinkIds = new Set(data.links.map((l) => l.id))
    for (const id of [...linkStore.current.keys()]) {
      if (!nextLinkIds.has(id)) linkStore.current.delete(id)
    }

    for (const l of data.links) {
      if (!linkStore.current.has(l.id)) {
        linkStore.current.set(l.id, { ...l })
      } else {
        linkStore.current.get(l.id)!.predicateLabel = l.predicateLabel
      }
    }

    return {
      nodes: data.nodes.map((n) => nodeStore.current.get(n.id)!),
      links: data.links.map((l) => linkStore.current.get(l.id)!),
    }
  }, [data, selectedNodeId, graphEpoch])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect
      if (!cr) return
      setSize({ w: Math.floor(cr.width), h: Math.floor(cr.height) })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // Configure forces once; do NOT reheat on every node add
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const charge = fg.d3Force('charge') as { strength?: (n: number) => void } | undefined
    charge?.strength?.(-80)
    const link = fg.d3Force('link') as { distance?: (n: number) => void } | undefined
    link?.distance?.(100)
  }, [size.w, size.h])

  // Fresh graph: short layout then pin
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    for (const n of graphData.nodes) unpinNode(n)
    fg.d3ReheatSimulation()
    const t = window.setTimeout(() => {
      fg.zoomToFit?.(400, 80)
    }, 450)
    return () => window.clearTimeout(t)
  }, [graphEpoch])

  useEffect(() => {
    if (!selectedNodeId || !fgRef.current || dragging.current) return
    if (prevSelected.current === selectedNodeId) return
    prevSelected.current = selectedNodeId
    const node = nodeStore.current.get(selectedNodeId)
    if (node && typeof node.x === 'number' && typeof node.y === 'number') {
      fgRef.current.centerAt(node.x, node.y, 350)
      fgRef.current.zoom(1.6, 350)
    }
  }, [selectedNodeId])

  const handleEngineStop = useCallback(() => {
    if (dragging.current) return
    for (const n of nodeStore.current.values()) {
      pinNode(n)
    }
  }, [])

  const handleNodeDrag = useCallback((node: GraphNode) => {
    dragging.current = true
    unpinNode(node)
  }, [])

  const handleNodeDragEnd = useCallback((node: GraphNode) => {
    pinNode(node)
    node.vx = 0
    node.vy = 0
    dragging.current = false
  }, [])

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const selected = node.id === selectedNodeId
      const degree = Math.min(
        data.links.filter(
          (l) =>
            nodeId(l.source as string | GraphNode) === node.id ||
            nodeId(l.target as string | GraphNode) === node.id,
        ).length,
        10,
      )
      const r = 6 + degree * 0.55 + (selected ? 2.5 : 0)
      const isClass = node.type === 'class'
      const base = isClass ? COLORS.nodeClass : COLORS.node

      if (selected) {
        ctx.beginPath()
        ctx.arc(x, y, r * 2.2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(240, 199, 94, 0.14)'
        ctx.fill()
      }

      const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      grad.addColorStop(0, selected ? '#ffe9a8' : isClass ? '#c5e4f5' : '#7dffc0')
      grad.addColorStop(1, selected ? COLORS.nodeSelected : base)

      if (isClass) {
        ctx.beginPath()
        ctx.moveTo(x, y - r)
        ctx.lineTo(x + r, y)
        ctx.lineTo(x, y + r)
        ctx.lineTo(x - r, y)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = selected ? '#fff3c4' : 'rgba(232, 241, 240, 0.45)'
        ctx.lineWidth = (selected ? 2 : 1) / globalScale
        ctx.stroke()
      } else {
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
        ctx.strokeStyle = selected ? '#fff3c4' : 'rgba(232, 241, 240, 0.35)'
        ctx.lineWidth = (selected ? 2 : 1) / globalScale
        ctx.stroke()
      }

      const label = node.label.length > 22 ? `${node.label.slice(0, 20)}…` : node.label
      const fontSize = Math.max(12 / globalScale, 3)
      ctx.font = `${selected ? 600 : 500} ${fontSize}px Outfit, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillStyle = COLORS.label
      ctx.fillText(label, x, y + r + 3)
    },
    [selectedNodeId, data.links],
  )

  const paintPointer = useCallback(
    (node: GraphNode, color: string, ctx: CanvasRenderingContext2D) => {
      ctx.beginPath()
      ctx.arc(node.x ?? 0, node.y ?? 0, 16, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    },
    [],
  )

  const paintLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const src = link.source as GraphNode
      const tgt = link.target as GraphNode
      if (typeof src !== 'object' || typeof tgt !== 'object') return
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return

      const hot =
        link.id === highlightedLinkId ||
        nodeId(src) === selectedNodeId ||
        nodeId(tgt) === selectedNodeId

      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = hot ? COLORS.linkHot : COLORS.link
      ctx.lineWidth = (hot ? 2 : 1.2) / globalScale
      ctx.stroke()

      if (hot || globalScale > 1.3) {
        const mx = (src.x + tgt.x) / 2
        const my = (src.y + tgt.y) / 2
        const fontSize = Math.max(10 / globalScale, 2.4)
        ctx.font = `500 ${fontSize}px Outfit, sans-serif`
        ctx.fillStyle = hot ? 'rgba(240, 199, 94, 0.95)' : 'rgba(200, 220, 220, 0.7)'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const text =
          link.predicateLabel.length > 18
            ? `${link.predicateLabel.slice(0, 16)}…`
            : link.predicateLabel
        ctx.fillText(text, mx, my - 3)
      }
    },
    [highlightedLinkId, selectedNodeId],
  )

  return (
    <div className="graph-stage" ref={wrapRef}>
      <div className="graph-atmosphere" aria-hidden />
      <div className="graph-grid" aria-hidden />
      {size.w > 0 && size.h > 0 && (
        <ForceGraph2D
          ref={fgRef as never}
          graphData={graphData as never}
          width={size.w}
          height={size.h}
          backgroundColor="rgba(0,0,0,0)"
          nodeCanvasObject={paintNode as never}
          nodePointerAreaPaint={paintPointer as never}
          linkCanvasObject={paintLink as never}
          linkDirectionalArrowLength={4}
          linkDirectionalArrowRelPos={0.92}
          linkDirectionalParticles={0}
          onNodeClick={(node) => onNodeClick(node as GraphNode)}
          onBackgroundClick={onBackgroundClick}
          onEngineStop={handleEngineStop}
          onNodeDrag={handleNodeDrag as never}
          onNodeDragEnd={handleNodeDragEnd as never}
          cooldownTicks={40}
          warmupTicks={30}
          d3AlphaDecay={0.08}
          d3VelocityDecay={0.4}
          enableNodeDrag
          enableZoomInteraction
          enablePanInteraction
        />
      )}
      {data.nodes.length > 0 && (
        <div className="graph-hint">
          Drag to reposition · Scroll to zoom · Click a node for full information
        </div>
      )}
    </div>
  )
}
