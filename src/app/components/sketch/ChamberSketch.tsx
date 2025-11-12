'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

type ItemType = 'in' | 'out' | 'label'

type SketchItem = {
  id: string
  type: ItemType
  x: number
  y: number
  label?: string
}

export type SketchState = {
  coverShape: 'Circle' | 'Square' | 'Rectangle' | 'Triangle'
  chamberShape: 'Circle' | 'Square' | 'Rectangle' | 'Hexagon'
  items: SketchItem[]
}

function uuid() {
  return Math.random().toString(36).slice(2)
}

export default function ChamberSketch({
  value,
  onChange,
}: {
  value?: SketchState
  onChange?: (s: SketchState) => void
}) {
  const [state, setState] = useState<SketchState>(
    value || { coverShape: 'Circle', chamberShape: 'Circle', items: [] }
  )
  const svgRef = useRef<SVGSVGElement | null>(null)
  const draggingId = useRef<string | null>(null)
  const [labelNext, setLabelNext] = useState<'A'|'B'|'C'|'D'|'E'|'F'|'G'|'H'|'I'|'J'|'K'|'L'|'M'|'N'|'O'|'P'|'Q'|'R'|'S'|'T'|'U'|'V'|'W'|'X'|'Y'|'Z'>('A')
  const [outletNext, setOutletNext] = useState<'X'|'Y'|'Z'>('X')

  useEffect(() => {
    onChange?.(state)
  }, [state, onChange])

  function bumpLetter(l: string, start: string, end: string) {
    const code = l.charCodeAt(0)
    const next = code + 1
    const endCode = end.charCodeAt(0)
    const startCode = start.charCodeAt(0)
    return (next > endCode ? startCode : next) as number
  }

  function addItem(type: ItemType) {
    const base: SketchItem = { id: uuid(), type, x: 250, y: 60 }
    if (type === 'label') {
      base.label = labelNext
      // advance A->B->...->Z->A
      const n = bumpLetter(labelNext, 'A', 'Z')
      setLabelNext(String.fromCharCode(n) as any)
    }
    if (type === 'out') {
      base.label = outletNext
      // advance X->Y->Z->X
      const n = outletNext === 'X' ? 'Y' : outletNext === 'Y' ? 'Z' : 'X'
      setOutletNext(n as any)
    }
    setState((s) => ({ ...s, items: [...s.items, base] }))
  }

  function setCover(shape: SketchState['coverShape']) {
    setState((s) => ({ ...s, coverShape: shape }))
  }
  function setChamber(shape: SketchState['chamberShape']) {
    setState((s) => ({ ...s, chamberShape: shape }))
  }

  function onPointerDown(e: React.PointerEvent, id: string) {
    draggingId.current = id
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingId.current || !svgRef.current) return
    const pt = svgRef.current.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svgRef.current.getScreenCTM()
    if (!ctm) return
    const p = pt.matrixTransform(ctm.inverse())
    const x = Math.max(20, Math.min(480, p.x))
    const y = Math.max(20, Math.min(480, p.y))
    setState((s) => ({
      ...s,
      items: s.items.map((it) => (it.id === draggingId.current ? { ...it, x, y } : it)),
    }))
  }
  function onPointerUp() {
    draggingId.current = null
  }

  const center = { x: 250, y: 250 }

  const chamberPath = useMemo(() => {
    switch (state.chamberShape) {
      case 'Square':
        return <rect x={170} y={170} width={160} height={160} rx={2} ry={2} stroke="#777" fill="none" strokeWidth={3} />
      case 'Rectangle':
        return <rect x={140} y={190} width={220} height={120} rx={2} ry={2} stroke="#777" fill="none" strokeWidth={3} />
      case 'Hexagon':
        return (
          <polygon
            points="250,150 330,200 330,300 250,350 170,300 170,200"
            stroke="#777"
            fill="none"
            strokeWidth={3}
          />
        )
      default:
        return <circle cx={250} cy={250} r={80} stroke="#777" fill="none" strokeWidth={3} />
    }
  }, [state.chamberShape])

  const coverPath = useMemo(() => {
    switch (state.coverShape) {
      case 'Square':
        return <rect x={120} y={120} width={260} height={260} strokeDasharray="6 6" stroke="#333" fill="none" strokeWidth={2} />
      case 'Rectangle':
        return <rect x={100} y={150} width={300} height={200} strokeDasharray="6 6" stroke="#333" fill="none" strokeWidth={2} />
      case 'Triangle':
        return (
          <polygon points="250,110 380,370 120,370" strokeDasharray="6 6" stroke="#333" fill="none" strokeWidth={2} />
        )
      default:
        return <rect x={120} y={120} width={260} height={260} strokeDasharray="6 6" stroke="#333" fill="none" strokeWidth={2} />
    }
  }, [state.coverShape])

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <div className="flex items-center gap-2 bg-pink-50 border rounded px-2 py-1">
          <span className="text-sm font-semibold">Cover</span>
          {(['Circle', 'Square', 'Rectangle', 'Triangle'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setCover(s)}
              className={`px-2 py-1 rounded border ${state.coverShape === s ? 'bg-blue-100 border-blue-300' : 'bg-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-pink-50 border rounded px-2 py-1">
          <span className="text-sm font-semibold">Chamber</span>
          {(['Circle', 'Square', 'Rectangle', 'Hexagon'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setChamber(s)}
              className={`px-2 py-1 rounded border ${state.chamberShape === s ? 'bg-blue-100 border-blue-300' : 'bg-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-green-50 border rounded px-2 py-1">
          <button type="button" className="px-2 py-1 rounded border" onClick={() => addItem('in')}>Add Inlet</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => addItem('out')}>Add Outlet</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => addItem('label')}>Add Label</button>
          <button type="button" className="px-2 py-1 rounded border" onClick={() => setState({ ...state, items: [] })}>Clear</button>
        </div>
      </div>

      {/* Canvas */}
      <div className="bg-white border rounded shadow-sm">
        <svg
          ref={svgRef}
          width="100%"
          height="360"
          viewBox="0 0 500 500"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* north arrow */}
          <g transform="translate(40,420)">
            <polygon points="10,0 20,30 0,30" fill="#e11" />
            <text x="8" y="44" fontSize="12" fill="#333">N</text>
          </g>

          {coverPath}
          {chamberPath}

          {/* Items */}
          {state.items.map((it) => {
            const color = it.type === 'in' ? '#1d4ed8' : it.type === 'out' ? '#dc2626' : '#111827'
            const arrowPath = it.type === 'out'
              ? `M ${center.x},${center.y} L ${it.x},${it.y}`
              : `M ${it.x},${it.y} L ${center.x},${center.y}`
            return (
              <g key={it.id}>
                {it.type !== 'label' && (
                  <>
                    <path d={arrowPath} stroke={color} strokeWidth={2.5} fill="none" markerEnd="url(#arrow)" />
                    <rect
                      x={it.x - 6}
                      y={it.y - 6}
                      width={12}
                      height={12}
                      fill={color}
                      onPointerDown={(e) => onPointerDown(e, it.id)}
                      style={{ cursor: 'grab' }}
                    />
                    {it.type === 'out' && it.label && (
                      <text x={it.x + 8} y={it.y - 8} fontSize="12" fill={color} fontWeight={600}>{it.label}</text>
                    )}
                  </>
                )}
                {it.type === 'label' && (
                  <>
                    <text x={it.x} y={it.y} fontSize="14" fill={color}>{it.label || 'ABC'}</text>
                    <rect
                      x={it.x - 6}
                      y={it.y - 6}
                      width={12}
                      height={12}
                      fill="#10b981"
                      opacity={0.6}
                      onPointerDown={(e) => onPointerDown(e, it.id)}
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
              <path d="M 0 0 L 6 3 L 0 6 z" fill="#111" />
            </marker>
          </defs>
        </svg>
      </div>

      <p className="mt-2 text-xs text-gray-600">Tip: Drag the small squares to position inlets/outlets or labels.</p>
    </div>
  )
}
