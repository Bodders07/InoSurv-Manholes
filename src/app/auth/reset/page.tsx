
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [fromInvite, setFromInvite] = useState(false)

  useEffect(() => {
    const init = async () => {
      // If the user opened this page from the email link, Supabase emits PASSWORD_RECOVERY
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
          setRecovering(true)
        }
      })
      // Also check existing session as a fallback
      const { data } = await supabase.auth.getSession()
      if (data.session) setRecovering(true)
      // Detect if the flow came from an invite
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        setFromInvite(params.get('from') === 'invite')
      }
      return () => sub.subscription.unsubscribe()
    }
    init()
  }, [])

  const heading = useMemo(() => (fromInvite ? 'Create Password' : 'Reset Password'), [fromInvite])
  const subcopy = useMemo(
    () =>
      fromInvite
        ? 'Create a password to finish setting up your account.'
        : 'Open this page from the password reset email link. If you reached this page directly, go back to the login screen and request a new reset email.',
    [fromInvite]
  )

  async function updatePassword() {
    if (!recovering) {
      setMessage('Invalid or expired recovery link. Request a new reset email.')
      return
    }
    if (!newPassword || newPassword !== confirmPassword) {
      setMessage('Passwords do not match.')
      return
    }
    setMessage('')
    setUpdating(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setUpdating(false)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Success: Password updated. Redirecting…')
      setTimeout(() => router.replace('/'), 1000)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
      <div className="bg-white border border-slate-200 p-8 rounded-xl shadow-md w-full max-w-sm text-slate-900">
        <h1 className="text-2xl font-bold mb-4 text-center">{heading}</h1>
        {!recovering && <p className="text-sm text-slate-600 mb-4">{subcopy}</p>}
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-slate-200 rounded p-2 mb-3 bg-white text-slate-900 placeholder:text-slate-400"
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border border-slate-200 rounded p-2 mb-4 bg-white text-slate-900 placeholder:text-slate-400"
        />
        <button
          onClick={updatePassword}
          disabled={!newPassword || !confirmPassword || updating}
          className={`w-full p-2 rounded text-white ${!newPassword || !confirmPassword || updating ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {updating ? (fromInvite ? 'Setting…' : 'Updating…') : (fromInvite ? 'Set Password' : 'Update Password')}
        </button>
        {message && <p className="mt-4 text-center text-sm text-red-500">{message}</p>}
      </div>
    </div>
  )
}
