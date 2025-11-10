'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
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
  const [active, setActive] = useState('dashboard')
  const router = useRouter()

  // Basic auth guard: redirect to /auth if no session
  useEffect(() => {
    let unsub: (() => void) | undefined
    const init = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) router.replace('/auth')
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
      })
      unsub = () => sub.data.subscription.unsubscribe()
    }
    init()
    return () => {
      try { unsub?.() } catch {}
    }
  }, [router])

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/' },
    { id: 'projects', label: 'Projects', icon: <FolderKanban size={18} />, href: '/projects' },
    { id: 'manholes', label: 'Manholes', icon: <ClipboardList size={18} />, href: '/manholes' },
    { id: 'inspections', label: 'Inspections', icon: <ClipboardList size={18} />, href: '/inspections' },
    { id: 'settings', label: 'Settings', icon: <Settings size={18} />, href: '/settings' },
    { id: 'users', label: 'Users', icon: <Settings size={18} />, href: '/admin/users' },
    { id: 'privileges', label: 'User Privileges', icon: <Settings size={18} />, href: '/privileges' },
  ]

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-64 bg-gray-500 border-r border-gray-400 shadow-sm flex flex-col">
        <div className="p-4 border-b border-gray-400 flex items-center justify-center">
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
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                active === item.id
                  ? 'bg-blue-400 text-white'
                  : 'text-gray-100 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
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
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
