'use client'

import { useEffect, useState } from 'react'
import SidebarLayout from '@/app/components/SidebarLayout'

type ThemeChoice = 'system' | 'light' | 'dark'

function applyTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // Remove both classes first
  root.classList.remove('theme-light', 'theme-dark')
  if (choice === 'system') {
    // Honor system preference
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
  } else if (choice === 'light') {
    root.classList.add('theme-light')
  } else if (choice === 'dark') {
    root.classList.add('theme-dark')
  }
}

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeChoice>('system')

  useEffect(() => {
    const saved = (localStorage.getItem('theme') as ThemeChoice) || 'system'
    setTheme(saved)
    applyTheme(saved)
    // Keep in sync if system preference changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => theme === 'system' && applyTheme('system')
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  function onChange(next: ThemeChoice) {
    setTheme(next)
    localStorage.setItem('theme', next)
    applyTheme(next)
  }

  return (
    <SidebarLayout>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="bg-white border border-gray-200 rounded shadow-sm p-6 max-w-xl">
        <h2 className="text-lg font-semibold mb-3">Theme</h2>
        <p className="text-sm text-gray-600 mb-4">Choose your appearance preference.</p>
        <div className="flex gap-4 items-center">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === 'system'}
              onChange={() => onChange('system')}
            />
            <span>System</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={() => onChange('light')}
            />
            <span>Light</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={() => onChange('dark')}
            />
            <span>Dark</span>
          </label>
        </div>
      </div>
    </SidebarLayout>
  )
}

