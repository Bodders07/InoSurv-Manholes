'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type ItemType = 'in' | 'out' | 'label' | 'numeric-known' | 'numeric-unknown'

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
  measuredTo?: 'north' | 'hm'
}

const MAX_HISTORY = 50

type SketchSnapshot = {
  state: SketchState
  labelNext: string
  inletNext: string
  outletNext: 'X' | 'Y' | 'Z'
  numericNext: number
}

function cloneSketchState(value: SketchState): SketchState {
  return {
    coverShape: value.coverShape,
    chamberShape: value.chamberShape,
    items: value.items.map((it) => ({ ...it })),
    measuredTo: value.measuredTo ?? 'north',
  }
}

function uuid() {
  return Math.random().toString(36).slice(2)
}

function computeNextNumeric(items?: SketchItem[]) {
  if (!items?.length) return 1
  const maxFound = items.reduce((max, item) => {
    if (!item.label) return max
    const match = item.label.match(/(\d+)/)
    if (!match) return max
    const value = Number(match[1])
    return Number.isNaN(value) ? max : Math.max(max, value)
  }, 0)
  return maxFound > 0 ? maxFound + 1 : 1
}

export default function ChamberSketch({
  value,
  onChange,
  compact = false,
  palette = 'auto',
  minimal = false,
  showHandlesAlways = false,
  hideCoverControls = false,
}: {
  value?: SketchState
  onChange?: (s: SketchState) => void
  compact?: boolean
  palette?: 'auto' | 'print-light'
  minimal?: boolean // hides legend, cover controls, and dashed cover overlay
  showHandlesAlways?: boolean
  hideCoverControls?: boolean
}) {
  const [state, setSketchState] = useState<SketchState>(() => {
    if (value) {
      return { ...value, measuredTo: value.measuredTo ?? 'north' }
    }
    return { coverShape: 'Circle', chamberShape: 'Circle', items: [], measuredTo: 'north' }
  })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragging = useRef<{ id: string; handle: 'start' | 'end' | 'label' } | null>(null)
  const [labelNext, setLabelNext] = useState('A')
  const [inletNext, setInletNext] = useState('A')
  const [outletNext, setOutletNext] = useState<'X' | 'Y' | 'Z'>('X')
  const [numericNext, setNumericNext] = useState(() => computeNextNumeric(value?.items))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const historyRef = useRef<SketchSnapshot[]>([])
  const [, forceHistoryVersion] = useState(0)
  const dragSnapshotCaptured = useRef(false)

  useEffect(() => {
    onChange?.(state)
  }, [state, onChange])

  useEffect(() => {
    setNumericNext(computeNextNumeric(value?.items))
  }, [value])

  const pushHistorySnapshot = useCallback(() => {
    historyRef.current = [
      ...historyRef.current,
      {
        state: cloneSketchState(state),
        labelNext,
        inletNext,
        outletNext,
        numericNext,
      },
    ]
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift()
    }
    forceHistoryVersion((v) => v + 1)
  }, [state, labelNext, inletNext, outletNext, numericNext])

  const canUndo = historyRef.current.length > 0

  const undo = () => {
    const previous = historyRef.current.pop()
    if (!previous) return
    dragSnapshotCaptured.current = false
    setSketchState(previous.state)
    setLabelNext(previous.labelNext)
    setInletNext(previous.inletNext)
    setOutletNext(previous.outletNext)
    setNumericNext(previous.numericNext)
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
    if (type === 'numeric-known' || type === 'numeric-unknown') {
      base.label = `Pipe ${numericNext}`
      setNumericNext((n) => n + 1)
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
  function setMeasuredTarget(target: 'north' | 'hm') {
    if ((state.measuredTo ?? 'north') === target) return
    pushHistorySnapshot()
    setSketchState((s) => ({ ...s, measuredTo: target }))
  }

  function resetCounters() {
    setLabelNext('A')
    setInletNext('A')
    setOutletNext('X')
    setNumericNext(1)
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
        {!minimal && !hideCoverControls && (
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
        )}
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
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold sketch-group__label`}>X-ABC</span>
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
        <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-2 py-1'} border rounded sketch-group`}>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold sketch-group__label`}>1-9</span>
          <button
            type="button"
            className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'}`}
            onClick={() => addItem('numeric-known')}
          >
            Add Pipe (Known Direction)
          </button>
          <button
            type="button"
            className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'}`}
            onClick={() => addItem('numeric-unknown')}
          >
            Add Pipe (Unknown Direction)
          </button>
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
        <div className={`flex items-center ${compact ? 'gap-1 px-2 py-1' : 'gap-2 px-2 py-1'} border rounded sketch-group`}>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-semibold sketch-group__label`}>Measured to</span>
          {(['north', 'hm'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setMeasuredTarget(opt)}
              className={`sketch-btn rounded border ${compact ? 'text-xs px-2 py-1' : 'px-2 py-1'} ${ (state.measuredTo ?? 'north') === opt ? 'sketch-btn--active' : ''}`}
            >
              {opt === 'north' ? 'North' : 'High Miles'}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        className="bg-white border rounded shadow-sm"
        style={
          palette === 'print-light'
            ? ({
                '--sketch-text': '#111111',
                '--sketch-cover': '#111111',
                '--sketch-chamber': '#111111',
                '--sketch-legend-bg': '#ffffff',
                '--sketch-legend-border': '#d1d5db',
                '--sketch-arrow': '#111111',
                '--sketch-numeric': '#111111',
              } as React.CSSProperties)
            : undefined
        }
      >
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
          {!minimal && (
            <g transform={compact ? 'translate(8,8)' : 'translate(12,12)'}>
              <rect x="0" y="0" width={compact ? 140 : 170} height={compact ? 38 : 46} rx="6" ry="6" fill="var(--sketch-legend-bg, #ffffff)" stroke="var(--sketch-legend-border, #e5e7eb)" />
              {/* Cover sample (dashed) */}
              <rect x={compact ? 8 : 10} y={compact ? 8 : 10} width={compact ? 16 : 20} height={compact ? 8 : 10} strokeDasharray="4 3" stroke="var(--sketch-cover, #333)" fill="none" strokeWidth="2" />
              <text x={compact ? 30 : 38} y={compact ? 16 : 18} fontSize={compact ? 10 : 12} fill="var(--sketch-text, #374151)">Cover (dashed)</text>
              {/* Chamber sample (solid) */}
              <line x1={compact ? 8 : 10} y1={compact ? 26 : 32} x2={compact ? 24 : 30} y2={compact ? 26 : 32} stroke="var(--sketch-chamber, #777)" strokeWidth="3" />
              <text x={compact ? 30 : 38} y={compact ? 29 : 35} fontSize={compact ? 10 : 12} fill="var(--sketch-text, #374151)">Chamber (solid)</text>
            </g>
          )}

          {/* north/high-miles arrow */}
          <g transform="translate(40,420)">
            <polygon points="10,0 20,30 0,30" fill="#e11" />
            <text x="8" y="44" fontSize="12" fill="var(--sketch-text, #333)">
              {(state.measuredTo ?? 'north') === 'north' ? 'N' : 'HM'}
            </text>
          </g>

          {!minimal && coverPath}
          {chamberPath}

          {/* Items */}
          {state.items.map((it) => {
            const isNumeric = it.type === 'numeric-known' || it.type === 'numeric-unknown'
            const palettePrint = palette === 'print-light'
            const baseColor = palettePrint
              ? '#111111'
              : it.type === 'in'
                ? '#1d4ed8'
                : it.type === 'out'
                  ? '#dc2626'
                  : '#111827'
            const color = isNumeric ? (palettePrint ? '#111111' : 'var(--sketch-numeric, #111827)') : baseColor
            const sx = it.sx ?? center.x
            const sy = it.sy ?? center.y
            const ex = it.ex ?? it.x ?? center.x
            const ey = it.ey ?? it.y ?? center.y
            const isInlet = it.type === 'in'
            const hasArrowHead = it.type === 'in' || it.type === 'out' || it.type === 'numeric-known'
            const arrowPath = isInlet ? `M ${ex},${ey} L ${sx},${sy}` : `M ${sx},${sy} L ${ex},${ey}`
            const startPoint = isInlet ? { x: ex, y: ey } : { x: sx, y: sy }
            const endPoint = isInlet ? { x: sx, y: sy } : { x: ex, y: ey }
            const labelPoint =
              it.type === 'in'
                ? startPoint
                : it.type === 'numeric-known' || it.type === 'numeric-unknown'
                  ? { x: (startPoint.x + endPoint.x) / 2, y: (startPoint.y + endPoint.y) / 2 }
                  : endPoint
            const handleSize = compact ? 20 : 24
            const hh = handleSize / 2
            const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x)
            return (
              <g key={it.id}>
                {it.type !== 'label' && (
                  <>
                    <path
                      d={arrowPath}
                      stroke={color}
                      strokeWidth={compact ? 4 : 5}
                      fill="none"
                      markerEnd={hasArrowHead ? 'url(#arrow)' : undefined}
                      onPointerDown={(evt) => {
                        evt.stopPropagation()
                        setSelectedId(it.id)
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    {(selectedId === it.id || showHandlesAlways) && (
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
                      isNumeric ? (
                        <text
                          transform={`translate(${(startPoint.x + endPoint.x) / 2}, ${(startPoint.y + endPoint.y) / 2}) rotate(${
                            (() => {
                              let deg = angle * (180 / Math.PI)
                              if (deg > 90 || deg < -90) deg += 180
                              return deg
                            })()
                          })`}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="12"
                          fill={color}
                          fontWeight={600}
                        >
                          {it.label}
                        </text>
                      ) : (
                        <text x={labelPoint.x + 8} y={labelPoint.y - 8} fontSize="12" fill={color} fontWeight={600}>
                          {it.label}
                        </text>
                      )
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
