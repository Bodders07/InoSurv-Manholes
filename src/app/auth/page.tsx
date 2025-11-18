'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
  const router = useRouter()
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL || 'Example@example.co.uk'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function signInWithPassword() {
    if (!email || !password) {
      setMessage('Please enter email and password.')
      return
    }
    setMessage('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setMessage('Error: ' + error.message)
    else router.replace('/')
  }

  // Account creation is disabled; users are invited via admin only.

  async function sendPasswordReset() {
    let targetEmail = email.trim()
    if (!targetEmail && typeof window !== 'undefined') {
      const entered = window.prompt('Enter the email for your Drainage Inspection account:')
      targetEmail = (entered || '').trim()
      if (targetEmail) {
        setEmail(targetEmail)
      }
    }
    if (!targetEmail) {
      setMessage('Please enter your email to reset your password.')
      return
    }
    setMessage('')
    setResetting(true)
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to send reset email.')
      setMessage('Success: Password reset email sent.')
    } catch (err) {
      setMessage(err instanceof Error ? `Error: ${err.message}` : 'Unable to send reset email.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#111111] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#1f2538] bg-[#10162b] px-6 py-7 text-white shadow-xl">
        <h1 className="text-2xl font-bold mb-2 text-center text-white">Surveyor Login</h1>
        <p className="text-xs text-gray-300 mb-6 text-center">
          Accounts are created by administrator invitation only.
        </p>
        <input
          type="email"
          placeholder={defaultEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-transparent rounded-lg p-3 mb-3 bg-white text-gray-900 placeholder:text-gray-500 shadow-inner"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-transparent rounded-lg p-3 mb-5 bg-white text-gray-900 placeholder:text-gray-500 shadow-inner"
        />
        <button
          onClick={signInWithPassword}
          disabled={!email || !password || loading}
          className={`w-full p-3 rounded-lg font-semibold transition text-white ${!email || !password || loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="mt-4 text-sm text-center">
          <button
            onClick={sendPasswordReset}
            disabled={!email || resetting}
            className={`underline ${!email || resetting ? 'text-gray-400 cursor-not-allowed' : 'text-blue-300 hover:text-blue-100'}`}
          >
            {resetting ? 'Sending reset…' : 'Forgot password?'}
          </button>
        </div>

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </div>
    </div>
  )
}
