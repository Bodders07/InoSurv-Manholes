'use client'

import { useEffect, useState } from 'react'

let onlineBarMounted = false

export default function OnlineStatusBar() {
  // Prevent duplicate bars if a nested render mounts this component twice
  if (onlineBarMounted) return null
  onlineBarMounted = true

  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    const update = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : null)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
      onlineBarMounted = false
    }
  }, [])

  if (online === null) return null

  const text = online ? 'Online: connected' : 'Offline: changes will queue and sync later'
  const bg = online ? 'bg-green-600' : 'bg-red-600'

  return (
    <div className={`${bg} text-white text-sm px-4 py-1 flex items-center gap-2`}>
      <span className="inline-block h-2 w-2 rounded-full bg-white/80" />
      <span>{text}</span>
    </div>
  )
}
