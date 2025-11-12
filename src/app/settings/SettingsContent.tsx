'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

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
  const router = useRouter()
  const [choice, setChoice] = useState<ThemeChoice>('dark')
  const [saved, setSaved] = useState<ThemeChoice>('dark')
  // Password change state
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdPending, setPwdPending] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

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

  async function changePassword() {
    setPwdMsg('')
    if (!curPwd || !newPwd || !confirmPwd) {
      setPwdMsg('Please complete all password fields.')
      return
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg('New passwords do not match.')
      return
    }
    if (newPwd.length < 8) {
      setPwdMsg('New password must be at least 8 characters.')
      return
    }
    setPwdPending(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const email = userData.user?.email || ''
      if (!email) {
        setPwdMsg('Unable to determine current user email. Please sign in again.')
        setPwdPending(false)
        return
      }
      const reauth = await supabase.auth.signInWithPassword({ email, password: curPwd })
      if (reauth.error) {
        setPwdMsg('Current password is incorrect.')
        setPwdPending(false)
        return
      }
      const upd = await supabase.auth.updateUser({ password: newPwd })
      if (upd.error) {
        setPwdMsg('Error: ' + upd.error.message)
      } else {
        // Force sign-out and redirect to login
        try { await supabase.auth.signOut() } catch {}
        setPwdMsg('Success: Password updated. Redirecting to sign in…')
        setCurPwd('')
        setNewPwd('')
        setConfirmPwd('')
        // Small delay to show message, then redirect
        setTimeout(() => router.replace('/auth'), 300)
      }
    } catch (e: any) {
      setPwdMsg('Error: ' + (e?.message || 'Failed to update password'))
    } finally {
      setPwdPending(false)
    }
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

      <div className="bg-white border border-gray-200 rounded shadow-sm p-6 max-w-xl mt-6">
        <h2 className="text-lg font-semibold mb-3">Change Password</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Current Password</label>
            <input
              type="password"
              className="w-full border rounded p-2"
              value={curPwd}
              onChange={(e) => setCurPwd(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">New Password</label>
            <input
              type="password"
              className="w-full border rounded p-2"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Confirm New Password</label>
            <input
              type="password"
              className="w-full border rounded p-2"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            {pwdMsg && (
              <p className={`text-sm ${pwdMsg.startsWith('Success') ? 'text-green-700' : 'text-red-600'}`}>{pwdMsg}</p>
            )}
            <button
              onClick={changePassword}
              disabled={pwdPending}
              className={`px-4 py-2 rounded text-white ${pwdPending ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {pwdPending ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
