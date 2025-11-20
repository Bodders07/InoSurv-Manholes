'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo } from '@/lib/roles'
import type { PermissionConfig, RoleKey } from '@/types/permissions'

type PermissionContextValue = {
  role: RoleKey
  loading: boolean
  has: (key: string) => boolean
  allowedKeys: Set<string>
}

const defaultValue: PermissionContextValue = {
  role: 'viewer',
  loading: true,
  has: () => false,
  allowedKeys: new Set(),
}

const PermissionsContext = createContext<PermissionContextValue>(defaultValue)

function flattenAllowed(config: PermissionConfig | null, role: RoleKey) {
  if (!config) return []
  const categories = config[role]
  if (!categories) return []
  return Object.values(categories).flatMap((entries) =>
    entries.filter((entry) => entry.allowed).map((entry) => entry.key),
  )
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<RoleKey>('viewer')
  const [config, setConfig] = useState<PermissionConfig | null>(null)
  const [configReady, setConfigReady] = useState(false)

  const detectRole = useCallback((user: Parameters<typeof deriveRoleInfo>[0]) => {
    try {
      const info = deriveRoleInfo(user)
      setRole(info.roleKey)
    } catch {
      setRole('viewer')
    }
  }, [])

  useEffect(() => {
    let active = true
    async function initRole() {
      try {
        const { data } = await supabase.auth.getUser()
        if (!active) return
        detectRole(data.user)
      } catch {
        if (active) setRole('viewer')
      }
    }
    initRole()
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => detectRole(session?.user))
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [detectRole])

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load permissions')
      const payload = (await res.json()) as PermissionConfig
      setConfig(payload)
    } catch (err) {
      console.error('Failed to load permissions config', err)
      setConfig(null)
    } finally {
      setConfigReady(true)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    const handler = () => loadConfig()
    window.addEventListener('permissions-updated', handler)
    return () => window.removeEventListener('permissions-updated', handler)
  }, [loadConfig])

  useEffect(() => {
    function handleFocus() {
      loadConfig()
    }
    window.addEventListener('focus', handleFocus)
    const interval = window.setInterval(loadConfig, 60_000)
    return () => {
      window.removeEventListener('focus', handleFocus)
      window.clearInterval(interval)
    }
  }, [loadConfig])

  const allowedKeys = useMemo(() => {
    const flattened = flattenAllowed(config, role)
    return new Set(flattened)
  }, [config, role])

  const has = useCallback((key: string) => allowedKeys.has(key), [allowedKeys])

  const value = useMemo<PermissionContextValue>(
    () => ({
      role,
      loading: !configReady,
      has,
      allowedKeys,
    }),
    [role, configReady, has, allowedKeys],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
