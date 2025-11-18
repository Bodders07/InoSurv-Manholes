'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ItemType = 'in' | 'out' | 'label'

type SketchItem = {
  id: string
  type: ItemType
  // For labels
  x?: number
  y?: number
  // For arrows (in/out) allow two draggable ends
  sx?: number
  sy?: number
  ex?: number
  ey?: number
  label?: string
}

export type SketchState = {
  coverShape: 'Circle' | 'Square' | 'Rectangle' | 'Triangle'
  chamberShape: 'Circle' | 'Square' | 'Rectangle' | 'Hexagon'
  items: SketchItem[]
}

const MAX_HISTORY = 50

type SketchSnapshot = {
  state: SketchState
  labelNext: string
  inletNext: string
  outletNext: 'X' | 'Y' | 'Z'
}

function cloneSketchState(value: SketchState): SketchState {
  return {
    coverShape: value.coverShape,
    chamberShape: value.chamberShape,
    items: value.items.map((it) => ({ ...it })),
  }
}

function uuid() {
  return Math.random().toString(36).slice(2)
}

export default function ChamberSketch({
  value,
  onChange,
  compact = false,
}: {
  value?: SketchState
  onChange?: (s: SketchState) => void
  compact?: boolean
}) {
  const [state, setSketchState] = useState<SketchState>(
    value || { coverShape: 'Circle', chamberShape: 'Circle', items: [] }
  )
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef<{ id: string; handle: 'start' | 'end' | 'label' } | null>(null)
  const [labelNext, setLabelNext] = useState('A')
  const [inletNext, setInletNext] = useState('A')
  const [outletNext, setOutletNext] = useState<'X' | 'Y' | 'Z'>('X')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const historyRef = useRef<SketchSnapshot[]>([])
  const [, forceHistoryVersion] = useState(0)
  const dragSnapshotCaptured = useRef(false)

  useEffect(() => {
    onChange?.(state)
  }, [state, onChange])

  const pushHistorySnapshot = useCallback(() => {
    historyRef.current = [
      ...historyRef.current,
      {
        state: cloneSketchState(state),
        labelNext,
        inletNext,
        outletNext,
      },
    ]
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    forceHistoryVersion((v) => v + 1)
  }, [state, labelNext, inletNext, outletNext])

  const canUndo = historyRef.current.length > 0

  const undo = () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    dragSnapshotCaptured.current = false
    setSketchState(previous.state)
    setLabelNext(previous.labelNext)
    setInletNext(previous.inletNext)
    setOutletNext(previous.outletNext)
    forceHistoryVersion((v) => v + 1)
  }

  function bumpLetter(l: string, start: string, end: string) {
    const code = l.charCodeAt(0)
    const next = code + 1
    const endCode = end.charCodeAt(0)
    const startCode = start.charCodeAt(0)
    return (next > endCode ? startCode : next) as number
  }

  function addItem(type: ItemType) {
    pushHistorySnapshot()
    const base: SketchItem = { id: uuid(), type }
    // Defaults
    if (type === 'label') {
      base.x = 250; base.y = 60
    } else {
      // Arrow defaults: from center to above center
      base.sx = 250; base.sy = 250
      base.ex = 250; base.ey = 160
    }
    if (type === 'label') {
      base.label = labelNext
      // advance A->B->...->Z->A
      const n = bumpLetter(labelNext, 'A', 'Z')
      setLabelNext(String.fromCharCode(n))
    }
    if (type === 'in') {
      base.label = inletNext
      const n = bumpLetter(inletNext, 'A', 'Z')
      setInletNext(String.fromCharCode(n))
    }
    if (type === 'out') {
      base.label = outletNext
      // advance X->Y->Z->X
      const nextOutlet: 'X' | 'Y' | 'Z' = outletNext === 'X' ? 'Y' : outletNext === 'Y' ? 'Z' : 'X'
      setOutletNext(nextOutlet)
    }
    setSketchState((s) => ({ ...s, items: [...s.items, base] }))
  }

  function setCover(shape: SketchState['coverShape']) {
    if (state.coverShape === shape) return
    pushHistorySnapshot()
    setSketchState((s) => ({ ...s, coverShape: shape }))
  }
  function setChamber(shape: SketchState['chamberShape']) {
    if (state.chamberShape === shape) return
    pushHistorySnapshot()
    setSketchState((s) => ({ ...s, chamberShape: shape }))
  }

  function resetCounters() {
    setLabelNext('A')
    setInletNext('A')
    setOutletNext('X')
  }

  function handleClear() {
    if (!state.items.length) return
    pushHistorySnapshot()
    setSketchState((s) => ({ ...s, items: [] }))
    resetCounters()
  }

  function onPointerDown(e: React.PointerEvent, id: string, handle: 'start' | 'end' | 'label') {
    if (!dragSnapshotCaptured.current) {
      pushHistorySnapshot()
      dragSnapshotCaptured.current = true
    }
    setSelectedId(id)
    dragging.current = { id, handle }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    try { e.preventDefault() } catch {}
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current || !svgRef.current) return
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()
    if (!ctm) return
    const p = pt.matrixTransform(ctm.inverse())
    const x = Math.max(20, Math.min(480, p.x))
    const y = Math.max(20, Math.min(480, p.y))
    setSketchState((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== dragging.current!.id) return it
        const copy = { ...it }
        if (dragging.current!.handle === 'label') {
          copy.x = x; copy.y = y
        } else if (dragging.current!.handle === 'start') {
          copy.sx = x; copy.sy = y
        } else {
          copy.ex = x; copy.ey = y
        }
        return copy
      }),
    }))
  }
  function onPointerUp() {
    dragging.current = null
    dragSnapshotCaptured.current = false
  }

  // Fallback: allow starting drag by tapping near a handle (mobile-friendly)
  function startNearestHandleDrag(e: React.PointerEvent<SVGSVGElement>) {
    if (!svgRef.current) return
    if (e.target === svgRef.current) {
      setSelectedId(null)
    }
    if (!selectedId) return
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()
    if (!ctm) return
    const p = pt.matrixTransform(ctm.inverse())
    let best: { id: string; handle: 'start' | 'end' } | null = null
    let bestD = Infinity
    for (const it of state.items) {
      if (it.type === 'label' || it.id !== selectedId) continue
      const sx = it.sx ?? center.x
      const sy = it.sy ?? center.y
      const ex = it.ex ?? it.x ?? center.x
      const ey = it.ey ?? it.y ?? center.y
      const ds = Math.hypot(p.x - sx, p.y - sy)
      const de = Math.hypot(p.x - ex, p.y - ey)
      if (ds < bestD) { bestD = ds; best = { id: it.id, handle: 'start' } }
      if (de < bestD) { bestD = de; best = { id: it.id, handle: 'end' } }
    }
    // If within 28px, start dragging that handle
    if (best && bestD <= 28) {
      if (!dragSnapshotCaptured.current) {
        pushHistorySnapshot()
        dragSnapshotCaptured.current = true
      }
      dragging.current = best
      ;(e.target as Element).setPointerCapture?.(e.pointerId)
      try { e.preventDefault() } catch {}
    }
  }

  const center = { x: 250, y: 250 }

  const chamberPath = useMemo(() => {
    switch (state.chamberShape) {
      case 'Square':
        // Bigger square chamber
        return <rect x={140} y={140} width={220} height={220} rx={3} ry={3} stroke="var(--sketch-chamber, #777)" fill="none" strokeWidth={3} />
      case 'Rectangle':
        // Bigger rectangle chamber (taller than wide)
        return <rect x={170} y={100} width={160} height={300} rx={3} ry={3} stroke="var(--sketch-chamber, #777)" fill="none" strokeWidth={3} />
      case 'Hexagon':
        // Bigger hexagon chamber
        return (
          <polygon
            points="250,120 360,190 360,310 250,380 140,310 140,190"
            stroke="var(--sketch-chamber, #777)"
            fill="none"
            strokeWidth={3}
          />
        )
      default:
        // Bigger circular chamber
        return <circle cx={250} cy={250} r={120} stroke="var(--sketch-chamber, #777)" fill="none" strokeWidth={3} />
    }
  }, [state.chamberShape])

  const coverPath = useMemo(() => {
    switch (state.coverShape) {
      case 'Circle':
        // Smaller dashed circle inside the chamber
        return <circle cx={250} cy={250} r={70} strokeDasharray="6 6" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth={2} />
      case 'Square':
        // Smaller, inside the chamber
        return <rect x={190} y={190} width={120} height={120} strokeDasharray="6 6" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth={2} />
      case 'Rectangle':
        // Smaller, inside the chamber (taller than wide)
        return <rect x={210} y={190} width={80} height={120} strokeDasharray="6 6" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth={2} />
      case 'Triangle':
        // Smaller, centered triangle
        return (
          <polygon points="250,190 310,310 190,310" strokeDasharray="6 6" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth={2} />
        )
      default:
        // Default to a smaller dashed square inside
        return <rect x={190} y={190} width={120} height={120} strokeDasharray="6 6" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth={2} />
    }
  }, [state.coverShape])

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className={`flex flex-wrap items-center ${compact ? 'gap-1 mb-1' : 'gap-2 mb-2'} sketch-toolbar`}>
        <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-2 py-1'} border rounded sketch-group`}>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold sketch-group__label`}>Cover</span>
          {(['Circle', 'Square', 'Rectangle', 'Triangle'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setCover(s)}
              className={`sketch-btn ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'} rounded border ${state.coverShape === s ? 'sketch-btn--active' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-2 py-1'} border rounded sketch-group`}>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold sketch-group__label`}>Chamber</span>
          {(['Circle', 'Square', 'Rectangle', 'Hexagon'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setChamber(s)}
              className={`sketch-btn ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'} rounded border ${state.chamberShape === s ? 'sketch-btn--active' : ''}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-2 py-1'} border rounded sketch-group`}>
          <button type="button" className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'}`} onClick={() => addItem('in')}>Add Inlet</button>
          <button type="button" className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'}`} onClick={() => addItem('out')}>Add Outlet</button>
          <button
            type="button"
            className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'} disabled:opacity-50 disabled:cursor-not-allowed`}
            onClick={handleClear}
            disabled={!state.items.length}
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-white border rounded shadow-sm">
        <svg
          ref={svgRef}
          width="100%"
          height={compact ? 260 : 360}
          viewBox="0 0 500 500"
          style={{ touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerDown={startNearestHandleDrag}
        >
          {/* Key / Legend (top-left) */}
          <g transform={compact ? 'translate(8,8)' : 'translate(12,12)'}>
            <rect x="0" y="0" width={compact ? 140 : 170} height={compact ? 38 : 46} rx="6" ry="6" fill="var(--sketch-legend-bg, #ffffff)" stroke="var(--sketch-legend-border, #e5e7eb)" />
            {/* Cover sample (dashed) */}
            <rect x={compact ? 8 : 10} y={compact ? 8 : 10} width={compact ? 16 : 20} height={compact ? 8 : 10} strokeDasharray="4 3" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth="2" />
            <text x={compact ? 30 : 38} y={compact ? 16 : 18} fontSize={compact ? 10 : 12} fill="var(--sketch-text, #374151)">Cover (dashed)</text>
            {/* Chamber sample (solid) */}
            <line x1={compact ? 8 : 10} y1={compact ? 26 : 32} x2={compact ? 24 : 30} y2={compact ? 26 : 32} stroke="var(--sketch-chamber, #777)" strokeWidth="3" />
            <text x={compact ? 30 : 38} y={compact ? 29 : 35} fontSize={compact ? 10 : 12} fill="var(--sketch-text, #374151)">Chamber (solid)</text>
          </g>

          {/* north arrow */}
          <g transform="translate(40,420)">
            <polygon points="10,0 20,30 0,30" fill="#e11" />
            <text x="8" y="44" fontSize="12" fill="var(--sketch-text, #333)">N</text>
          </g>

          {coverPath}
          {chamberPath}

          {/* Items */}
          {state.items.map((it) => {
            const color = it.type === 'in' ? '#1d4ed8' : it.type === 'out' ? '#dc2626' : '#111827'
            const sx = it.sx ?? center.x
            const sy = it.sy ?? center.y
            const ex = it.ex ?? it.x ?? center.x
            const ey = it.ey ?? it.y ?? center.y
            // Keep previous direction semantics:
            // - inlet: arrow head at the 'center' end (sx,sy), so path starts at (ex,ey)
            // - outlet: arrow head at the handle (ex,ey), so path starts at (sx,sy)
            const arrowPath = it.type === 'in'
              ? `M ${ex},${ey} L ${sx},${sy}`
              : `M ${sx},${sy} L ${ex},${ey}`
            const handleSize = compact ? 20 : 24
            const hh = handleSize / 2
            return (
              <g key={it.id}>
                {it.type !== 'label' && (
                  <>
                    <path
                      d={arrowPath}
                      stroke={color}
                      strokeWidth={compact ? 3.5 : 4}
                      fill="none"
                      markerEnd="url(#arrow)"
                      onPointerDown={(evt) => {
                        evt.stopPropagation()
                        setSelectedId(it.id)
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    {selectedId === it.id && (
                      <>
                        <rect
                          x={sx - hh}
                          y={sy - hh}
                          width={handleSize}
                          height={handleSize}
                          fill={color}
                          onPointerDown={(e) => onPointerDown(e, it.id, 'start')}
                          style={{ cursor: 'grab' }}
                        />
                        <rect
                          x={ex - hh}
                          y={ey - hh}
                          width={handleSize}
                          height={handleSize}
                          fill={color}
                          onPointerDown={(e) => onPointerDown(e, it.id, 'end')}
                          style={{ cursor: 'grab' }}
                        />
                      </>
                    )}
                    {/* Labels sit at the handle end (ex,ey) for both types */}
                    {it.label && (
                      <text x={ex + 8} y={ey - 8} fontSize="12" fill={color} fontWeight={600}>{it.label}</text>
                    )}
                  </>
                )}
                {it.type === 'label' && (
                  <>
                    <text x={it.x!} y={it.y!} fontSize="14" fill={color}>{it.label || 'ABC'}</text>
                    <rect
                      x={it.x! - 6}
                      y={it.y! - 6}
                      width={12}
                      height={12}
                      fill="#10b981"
                      opacity={0.6}
                      onPointerDown={(e) => onPointerDown(e, it.id, 'label')}
                      style={{ cursor: 'grab' }}
                    />
                  </>
                )}
              </g>
            )
          })}

          {/* arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
              <path d="M 0 0 L 6 3 L 0 6 z" fill="var(--sketch-arrow, #111)" stroke="var(--sketch-arrow, #111)" />
            </marker>
          </defs>
        </svg>
      </div>

      <p className="mt-2 text-xs text-gray-600">Tip: Drag the small squares to position inlets/outlets or labels.</p>
    </div>
  )
}
