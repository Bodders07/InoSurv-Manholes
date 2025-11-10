'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo, canManageEverything } from '@/lib/roles'
import {
  LayoutDashboard,
  FolderKanban,
  ClipboardList,
  Settings,
} from 'lucide-react'

export default function SidebarLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [roleReady, setRoleReady] = useState(false)
  const [pageOpacity, setPageOpacity] = useState(1)

  // Basic auth guard: redirect to /auth if no session
  useEffect(() => {
    let unsub: (() => void) | undefined
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) {
        router.replace('/auth')
      }
      // Derive role immediately from current session to avoid flicker
      try {
        const user: any = data.session?.user
        if (user) {
          const info = deriveRoleInfo(user)
          setIsSuperAdmin(canManageEverything(info))
        }
      } catch {}
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
        if (!session) router.replace('/auth')
        // Re-evaluate role using the new session
        try {
          const info = deriveRoleInfo(session?.user)
          setIsSuperAdmin(canManageEverything(info))
        } catch {
          setIsSuperAdmin(false)
        }
        setRoleReady(true)
      })
      unsub = () => sub.data.subscription.unsubscribe()
      await detectRole()
      setRoleReady(true)
    }
    init()
    return () => {
      try { unsub?.() } catch {}
    }
  }, [router])

  async function detectRole() {
    try {
      // Use session (no network) to derive role quickly
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
      const info = deriveRoleInfo(user)
      setIsSuperAdmin(canManageEverything(info))
    } catch {
      setIsSuperAdmin(false)
    }
  }

  const publicNav = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} />, href: '/' },
    { id: 'projects', label: 'Projects', icon: <FolderKanban size={16} />, href: '/projects' },
    { id: 'manholes', label: 'Manholes', icon: <ClipboardList size={16} />, href: '/manholes' },
    { id: 'inspections', label: 'Inspections', icon: <ClipboardList size={16} />, href: '/inspections' },
    { id: 'settings', label: 'Settings', icon: <Settings size={16} />, href: '/settings' },
  ]
  const adminNav = isSuperAdmin ? [
    { id: 'users', label: 'User Management', icon: <Settings size={16} />, href: '/admin/users' },
    { id: 'privileges', label: 'User Privileges', icon: <Settings size={16} />, href: '/privileges' },
  ] : []
  const navItems = [...publicNav, ...adminNav]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  // Smooth fade between pages when pathname changes
  useEffect(() => {
    setPageOpacity(0)
    const t = setTimeout(() => setPageOpacity(1), 140)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="app-sidebar w-64 bg-gray-500 border-r border-gray-400 shadow-sm flex flex-col">
        <div className="p-4 border-b border-gray-400 flex flex-col items-center justify-center gap-2">
          <Link href="/" className="inline-flex">
            <Image
              src="/inorail-logo.png"
              alt="InoRail logo"
              width={220}
              height={70}
              priority
              className="h-10 w-auto max-w-full object-contain"
            />
            <span className="sr-only">Manhole Inspection</span>
          </Link>
        </div>
        <nav className="p-4 space-y-1">
          {!roleReady ? null : navItems.map((item) => {
            const isActive = pathname === item.href
            return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors text-sm leading-6 ${
                isActive
                  ? 'bg-blue-500 text-white font-semibold'
                  : 'text-gray-100 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
            )
          })}
        </nav>
        <div className="mt-auto p-4 border-t">
          <button
            onClick={handleSignOut}
            className="w-full text-left px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Main content area */}
      <main className="flex-1 p-8" style={{ opacity: pageOpacity, transition: 'opacity 220ms ease' }}>
        {children}
      </main>
    </div>
  )
}
