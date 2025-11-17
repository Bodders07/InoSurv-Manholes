'use client'

import { Suspense } from 'react'
import SidebarLayout from '@/app/components/SidebarLayout'
import SettingsContent from './SettingsContent'

export default function SettingsPage() {
  return (
    <SidebarLayout>
      <Suspense fallback={<div>Loading settings...</div>}>
        <SettingsContent />
      </Suspense>
    </SidebarLayout>
  )
}
