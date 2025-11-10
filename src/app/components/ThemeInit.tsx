'use client'

import { useEffect } from 'react'

type ThemeChoice = 'system' | 'light' | 'dark'

export default function ThemeInit() {
  useEffect(() => {
    const apply = (choice: ThemeChoice) => {
      const root = document.documentElement
      root.classList.remove('theme-light', 'theme-dark')
      if (choice === 'system') {
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
      } else {
        root.classList.add(choice === 'dark' ? 'theme-dark' : 'theme-light')
      }
    }

    const saved = (localStorage.getItem('theme') as ThemeChoice) || 'system'
    apply(saved)

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const current = (localStorage.getItem('theme') as ThemeChoice) || 'system'
      if (current === 'system') apply('system')
    }
    mq.addEventListener?.('change', handler)
    return () => mq.removeEventListener?.('change', handler)
  }, [])

  return null
}

