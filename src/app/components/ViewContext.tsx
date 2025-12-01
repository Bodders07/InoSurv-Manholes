'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type AppView =
  | 'dashboard'
  | 'projects'
  | 'manholes'
  | 'inspections'
  | 'settings'
  | 'users'
  | 'privileges'
  | 'storage'
  | 'recycle'
  | 'manholes_add'

type ViewCtx = {
  view: AppView
  setView: (v: AppView) => void
}

const Ctx = createContext<ViewCtx | null>(null)

export function ViewProvider({ children }: { children: React.ReactNode }) {
  // Always start on dashboard, regardless of last saved view.
  const [view, setView] = useState<AppView>('dashboard')

  // On mount, force persisted value to dashboard so reloads open there.
  useEffect(() => {
    try {
      localStorage.setItem('appView', 'dashboard')
    } catch {
      // ignore persistence errors
    }
  }, [])

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
