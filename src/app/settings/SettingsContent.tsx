'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { deriveRoleInfo } from '@/lib/roles'

type ThemeChoice = 'light' | 'dark'
type TabKey = 'profile' | 'security' | 'appearance'

function applyTheme(choice: ThemeChoice) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('theme-light', 'theme-dark')
  root.classList.add(choice === 'dark' ? 'theme-dark' : 'theme-light')
}

const TAB_IDS: TabKey[] = ['profile', 'security', 'appearance']

export default function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('theme') as ThemeChoice) || 'light'
  })
  const [saved, setSaved] = useState<ThemeChoice>(choice)
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  // Password change state
  const [curPwd, setCurPwd] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [pwdPending, setPwdPending] = useState(false)
  const [pwdMsg, setPwdMsg] = useState('')

  // Profile data
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [profileLoading, setProfileLoading] = useState(true)

  useEffect(() => {
    applyTheme(choice)
  }, [choice])

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true)
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user
        if (user) {
          const info = deriveRoleInfo(user)
          const name =
            (user.user_metadata?.full_name as string) ||
            (user.user_metadata?.name as string) ||
            user.email ||
            ''
          setFullName(name)
          setEmail(user.email || '')
          const label = info.isSuperAdmin
            ? 'Super Admin'
            : info.isAdmin
              ? 'Admin'
              : info.role
                ? info.role.charAt(0).toUpperCase() + info.role.slice(1)
                : 'Viewer'
          setRoleLabel(label)
        } else {
          setFullName('')
          setEmail('')
          setRoleLabel('')
        }
      } catch {
        setFullName('')
        setEmail('')
        setRoleLabel('')
      } finally {
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [])

  useEffect(() => {
    const requested = searchParams?.get('tab')
    if (requested && TAB_IDS.includes(requested as TabKey)) {
      setActiveTab(requested as TabKey)
    }
  }, [searchParams])

  function onChangeTheme(next: ThemeChoice) {
    setChoice(next)
    applyTheme(next)
  }

  function onSaveTheme() {
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
      const userEmail = userData.user?.email || ''
      if (!userEmail) {
        setPwdMsg('Unable to determine current user email. Please sign in again.')
        setPwdPending(false)
        return
      }
      const reauth = await supabase.auth.signInWithPassword({ email: userEmail, password: curPwd })
      if (reauth.error) {
        setPwdMsg('Current password is incorrect.')
        setPwdPending(false)
        return
      }
      const upd = await supabase.auth.updateUser({ password: newPwd })
      if (upd.error) {
        setPwdMsg('Error: ' + upd.error.message)
      } else {
        try { await supabase.auth.signOut() } catch {}
        setPwdMsg('Success: Password updated. Redirecting to sign in...')
        setCurPwd('')
        setNewPwd('')
        setConfirmPwd('')
        setTimeout(() => router.replace('/auth'), 300)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update password'
      setPwdMsg('Error: ' + msg)
    } finally {
      setPwdPending(false)
    }
  }

  const tabOptions = useMemo(
    () => [
      { id: 'profile' as TabKey, label: 'Profile' },
      { id: 'security' as TabKey, label: 'Security' },
      { id: 'appearance' as TabKey, label: 'Appearance' },
    ],
    [],
  )

  return (
    <>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="flex gap-6">
        <aside className="w-48 space-y-2">
          {tabOptions.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full text-left px-3 py-2 rounded-md border transition ${
                activeTab === tab.id
                  ? 'bg-orange-100 border-orange-300 text-orange-700 font-semibold'
                  : 'border-transparent text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <section className="flex-1 space-y-6">
          {activeTab === 'profile' && (
            <div className="bg-white border border-gray-200 rounded shadow-sm p-6 max-w-2xl">
              <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
              {profileLoading ? (
                <p className="text-sm text-gray-500">Loading profile...</p>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Full Name</label>
                    <input type="text" className="w-full border rounded p-2 bg-gray-50" value={fullName} readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email Address</label>
                    <input type="email" className="w-full border rounded p-2 bg-gray-50" value={email} readOnly />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Privilege</label>
                    <input type="text" className="w-full border rounded p-2 bg-gray-50" value={roleLabel || 'Viewer'} readOnly />
                  </div>
                  <p className="text-xs text-gray-500">Profile details are managed by your administrator.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white border border-gray-200 rounded shadow-sm p-6 max-w-2xl">
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
                    {pwdPending ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="bg-white border border-gray-200 rounded shadow-sm p-6 max-w-2xl">
              <h2 className="text-lg font-semibold mb-3">Appearance</h2>
              <p className="text-sm text-gray-600 mb-4">Choose the color mode for this browser.</p>
              <div className="flex gap-4 items-center">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={choice === 'light'}
                    onChange={() => onChangeTheme('light')}
                  />
                  <span>Light</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={choice === 'dark'}
                    onChange={() => onChangeTheme('dark')}
                  />
                  <span>Dark</span>
                </label>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  onClick={onSaveTheme}
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
          )}
        </section>
      </div>
    </>
  )
}
