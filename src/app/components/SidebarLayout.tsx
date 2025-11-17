'use client'

import Link from 'next/link'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo } from '@/lib/roles'
import { useView, type AppView } from '@/app/components/ViewContext'
import { usePermissions } from '@/app/components/PermissionsContext'
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Settings,
  Map,
  RefreshCw,
  Moon,
  Sun,
  ChevronDown,
} from 'lucide-react'

type ThemeChoice = 'light' | 'dark'

function applyDocumentTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  root.classList.add(choice === 'dark' ? 'theme-dark' : 'theme-light')
}

function initialsFromName(value: string) {
  if (!value) return ''
  const parts = value.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pageOpacity = 1
  const { view, setView } = useView()
  const [collapsed, setCollapsed] = useState(false)
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const { has, loading: permissionsLoading } = usePermissions()
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('light')
  const [userName, setUserName] = useState('')
  const [userRoleLabel, setUserRoleLabel] = useState('')
  const [userInitials, setUserInitials] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const updateUserDetails = (user: Parameters<typeof deriveRoleInfo>[0]) => {
    if (!user) {
      setUserName('')
      setUserRoleLabel('')
      setUserInitials('')
      return
    }
    const info = deriveRoleInfo(user)
    const displayName =
      (user.user_metadata?.full_name as string) ||
      (user.user_metadata?.name as string) ||
      user.email ||
      ''
    setUserName(displayName || info.email || '')
    const label = info.isSuperAdmin
      ? 'Super Admin'
      : info.isAdmin
        ? 'Admin'
        : info.role
          ? info.role.charAt(0).toUpperCase() + info.role.slice(1)
          : 'Viewer'
    setUserRoleLabel(label)
    const initialsSource = displayName || info.email || ''
    setUserInitials(initialsFromName(initialsSource))
  }

  // Basic auth guard: redirect to /auth if no session
  useEffect(() => {
    let unsub: (() => void) | undefined
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/auth')
        return
      }
      updateUserDetails(data.session.user ?? null)
      // If the user arrived via an invite link and hit any app page,
      // send them to the password setup flow.
      try {
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href)
          const from = url.searchParams.get('from')
          const isOnReset = url.pathname.startsWith('/auth/reset')
          if (from === 'invite' && !isOnReset) {
            router.replace('/auth/reset?from=invite')
            return
          }
        }
      } catch {}
      const sub = supabase.auth.onAuthStateChange((_e, session) => {
        if (!session) {
          router.replace('/auth')
          updateUserDetails(null)
        } else {
          updateUserDetails(session.user ?? null)
        }
      })
      unsub = () => sub.data.subscription.unsubscribe()
    }
    init()
    return () => {
      try { unsub?.() } catch {}
    }
  }, [router])

  useEffect(() => {
    if (typeof document === 'undefined') return
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'light' || stored === 'dark') {
        setThemeChoice(stored)
        applyDocumentTheme(stored)
      } else if (stored === 'system') {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        const fallback = prefersDark ? 'dark' : 'light'
        localStorage.setItem('theme', fallback)
        setThemeChoice(fallback)
        applyDocumentTheme(fallback)
      } else {
        localStorage.setItem('theme', 'light')
        setThemeChoice('light')
        applyDocumentTheme('light')
      }
    } catch {
      applyDocumentTheme(themeChoice)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let raf: number | null = null
    try {
      const saved = localStorage.getItem('sidebarCollapsed')
      if (saved != null) {
        raf = requestAnimationFrame(() => setCollapsed(saved === '1'))
      }
    } catch {}
    const applySize = () => setIsSmallScreen(window.innerWidth < 768)
    raf = requestAnimationFrame(applySize)
    const onResize = () => setIsSmallScreen(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!profileRef.current) return
      if (!profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem('sidebarCollapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  const publicNav: { id: AppView; label: string; icon: ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban size={16} /> },
    { id: 'manholes', label: 'Manholes', icon: <ClipboardList size={16} /> },
    { id: 'inspections', label: 'Map View', icon: <Map size={16} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} /> },
  ]
  const adminCatalog: { id: AppView; label: string; icon: ReactNode; permission: string }[] = [
    { id: 'users', label: 'User Management', icon: <Settings size={16} />, permission: 'change-roles' },
    { id: 'privileges', label: 'User Privileges', icon: <Settings size={16} />, permission: 'change-roles' },
    { id: 'storage', label: 'Storage Usage', icon: <Settings size={16} />, permission: 'view-storage' },
  ]
  const adminNav = adminCatalog.filter((item) => has(item.permission))
  const canSeeAdminTools = !permissionsLoading && has('view-admin-panels') && adminNav.length > 0

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const toggleTheme = () => {
    const next = themeChoice === 'dark' ? 'light' : 'dark'
    setThemeChoice(next)
    try {
      localStorage.setItem('theme', next)
    } catch {}
    applyDocumentTheme(next)
  }

  const refreshPage = () => {
    try {
      router.refresh()
    } catch {
      window.location.reload()
    }
  }

  const sidebarWidth = isSmallScreen ? (collapsed ? 'w-0' : 'w-64') : (collapsed ? 'w-14' : 'w-64')
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className={`app-sidebar ${sidebarWidth} bg-gray-500 border-r border-gray-400 shadow-sm flex flex-col transition-all duration-200 ease-in-out overflow-hidden`}>
        <div className="p-3 border-b border-gray-400 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="px-2 py-1 rounded text-white bg-gray-600 hover:bg-gray-700"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <Link href="/" className="inline-flex items-center justify-center flex-1">
            <Image
              src="/inorail-logo.png"
              alt="InoRail logo"
              width={collapsed ? 36 : 220}
              height={70}
              priority
              className={collapsed ? 'h-8 w-auto object-contain' : 'h-10 w-auto max-w-full object-contain'}
            />
            <span className="sr-only">Manhole Inspection</span>
          </Link>
        </div>
        <nav className={`p-2 ${collapsed ? 'space-y-1' : 'p-4 space-y-1'}`}>
          {publicNav.map((item) => {
            const isActive = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => { setView(item.id); try { if (window.innerWidth < 768) setCollapsed(true) } catch {} }}
                className={`flex items-center gap-2 ${collapsed ? 'px-2 justify-center' : 'px-3'} py-1.5 rounded-md transition-colors text-sm leading-6 ${
                  isActive
                    ? 'bg-blue-500 text-white font-semibold'
                    : 'text-gray-100 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {item.icon}
                <span className={`${collapsed ? 'hidden' : 'inline'} whitespace-nowrap`}>{item.label}</span>
              </button>
            )
          })}

          {canSeeAdminTools && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setAdminOpen((o) => !o)}
                className={`w-full flex items-center ${collapsed ? 'px-2 justify-center' : 'px-3 justify-between'} py-1.5 rounded-md transition-colors text-sm leading-6 text-gray-100 hover:bg-gray-600 hover:text-white`}
                aria-expanded={adminOpen}
              >
                <span className={`flex items-center gap-2 ${collapsed ? 'hidden' : 'inline'}`}>
                  <Settings size={16} />
                  <span>Admin Tools</span>
                </span>
                {!collapsed && <span className="ml-auto text-xs">{adminOpen ? '-' : '+'}</span>}
                {collapsed && <Settings size={16} />}
              </button>
              {adminOpen && !collapsed && (
                <div className="mt-1 space-y-1 pl-5">
                  {adminNav.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setView(item.id); try { if (window.innerWidth < 768) setCollapsed(true) } catch {} }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm leading-6 ${
                        view === item.id ? 'bg-blue-500 text-white font-semibold' : 'text-gray-100 hover:bg-gray-600 hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="whitespace-nowrap">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className={`mt-auto ${collapsed ? 'p-2' : 'p-4'} border-t`}>
          <button
            onClick={handleSignOut}
            className={`w-full ${collapsed ? 'text-center px-2' : 'text-left px-3'} py-2 rounded bg-red-600 text-white hover:bg-red-700 transition`}
          >
            {collapsed ? 'Out' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Mobile hamburger */}
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setCollapsed(false)}
        className="fixed left-2 top-2 z-50 md:hidden px-3 py-2 rounded bg-gray-700 text-white shadow"
      >
        Menu
      </button>

      {/* Main content area */}
      <main className="flex-1 p-4 md:p-8 overflow-auto" style={{ opacity: pageOpacity, transition: 'opacity 220ms ease' }}>
        <div className="sticky top-0 z-20 mb-6 -mx-4 md:-mx-8 flex flex-wrap items-center justify-end gap-3 border-b border-gray-200 bg-white px-4 py-3 shadow-sm md:px-8">
          <button
            type="button"
            onClick={refreshPage}
            className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:bg-gray-100"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {themeChoice === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-1 text-left shadow-sm hover:bg-gray-50"
            >
              <div className="hidden text-right md:flex md:flex-col">
                <span className="text-sm font-semibold leading-tight">{userName || 'Account'}</span>
                <span className="text-xs text-gray-500">{userRoleLabel || 'Role'}</span>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500 text-sm font-semibold text-white">
                {userInitials || '??'}
              </div>
              <ChevronDown size={16} className={`text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen(false)
                    try { localStorage.setItem('settingsActiveTab', 'profile') } catch {}
                    setView('settings')
                    router.push('/settings')
                  }}
                  className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                >
                  Profile Settings
                </button>
                <button
                  type="button"
                  onClick={() => { setProfileOpen(false); handleSignOut() }}
                  className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
