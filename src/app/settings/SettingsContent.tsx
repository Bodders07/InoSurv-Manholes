'use client'

import { useEffect, useState } from 'react'

type ThemeChoice = 'system' | 'light' | 'dark'

function applyTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  if (choice === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
  } else if (choice === 'light') {
    root.classList.add('theme-light')
  } else if (choice === 'dark') {
    root.classList.add('theme-dark')
  }
}

export default function SettingsContent() {
  const [choice, setChoice] = useState<ThemeChoice>('dark')
  const [saved, setSaved] = useState<ThemeChoice>('dark')

  useEffect(() => {
    const savedLS = (localStorage.getItem('theme') as ThemeChoice) || 'dark'
    setChoice(savedLS)
    setSaved(savedLS)
    applyTheme(savedLS)
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => (choice === 'system') && applyTheme('system')
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  function onChange(next: ThemeChoice) {
    setChoice(next)
    applyTheme(next)
  }

  function onSave() {
    localStorage.setItem('theme', choice)
    setSaved(choice)
  }

  return (
    <>
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
              checked={choice === 'system'}
              onChange={() => onChange('system')}
            />
            <span>System</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="light"
              checked={choice === 'light'}
              onChange={() => onChange('light')}
            />
            <span>Light</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={choice === 'dark'}
              onChange={() => onChange('dark')}
            />
            <span>Dark</span>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={onSave}
            disabled={choice === saved}
            className={`px-4 py-2 rounded text-white ${choice === saved ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            Save Preference
          </button>
          {choice !== saved && (
            <button
              onClick={() => { setChoice(saved); applyTheme(saved) }}
              className="px-4 py-2 rounded border border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  )
}

