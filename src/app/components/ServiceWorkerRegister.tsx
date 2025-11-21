'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js')
      } catch (err) {
        console.warn('Service worker registration failed', err)
      }
    }
    register()
  }, [])
  return null
}
