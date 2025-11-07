'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AuthPage() {
  const router = useRouter()
  const defaultEmail = process.env.NEXT_PUBLIC_DEFAULT_LOGIN_EMAIL || 'Example@example.co.uk'
  const [email, setEmail] = useState(defaultEmail)
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
    if (!email) {
      setMessage('Please enter your email to reset your password.')
      return
    }
    setMessage('')
    setResetting(true)
    const redirectTo =
      process.env.NEXT_PUBLIC_AUTH_RESET_URL ||
      (typeof window !== 'undefined' ? `${window.location.origin}/auth/reset` : undefined)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })
    setResetting(false)
    if (error) setMessage('Error: ' + error.message)
    else setMessage('Success: Password reset email sent.')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2 text-center">Inspector Login</h1>
        <p className="text-xs text-gray-600 mb-4 text-center">
          Accounts are created by administrator invitation only.
        </p>
        <input
          type="email"
          placeholder={defaultEmail}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 mb-3"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 mb-4"
        />
        <button
          onClick={signInWithPassword}
          disabled={!email || !password || loading}
          className={`w-full p-2 rounded transition text-white ${!email || !password || loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>

        <div className="mt-3 text-sm text-center">
          <div>
            <button
              onClick={sendPasswordReset}
              disabled={!email || resetting}
              className={`underline ${!email || resetting ? 'text-gray-400 cursor-not-allowed' : 'text-blue-700 hover:text-blue-900'}`}
            >
              {resetting ? 'Sending reset…' : 'Forgot password?'}
            </button>
          </div>
        </div>

        {message && <p className="mt-4 text-center text-sm">{message}</p>}
      </div>
    </div>
  )
}
