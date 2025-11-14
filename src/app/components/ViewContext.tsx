'use client'

import { createContext, useContext, useMemo, useState } from 'react'

export type AppView =
  | 'dashboard'
  | 'projects'
  | 'manholes'
  | 'inspections'
  | 'settings'
  | 'users'
  | 'privileges'
  | 'storage'
  | 'manholes_add'

type ViewCtx = {
  view: AppView
  setView: (v: AppView) => void
}

const Ctx = createContext<ViewCtx | null>(null)

export function ViewProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<AppView>(() => {
    if (typeof window === 'undefined') return 'dashboard'
    try {
      const saved = localStorage.getItem('appView') as AppView | null
      return saved || 'dashboard'
    } catch {
      return 'dashboard'
    }
  })

  const value = useMemo<ViewCtx>(() => ({
    view,
    setView: (v: AppView) => {
      setView(v)
      try { localStorage.setItem('appView', v) } catch {}
    },
  }), [view])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useView() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useView must be used within ViewProvider')
  return ctx
}
