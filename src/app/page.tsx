'use client'

import SidebarLayout from './components/SidebarLayout'

export default function HomePage() {
  return (
    <SidebarLayout>
      <h1 className="text-3xl font-semibold mb-4">Dashboard</h1>
      <p className="text-gray-600">
        Welcome to your dashboard! You can add summary widgets or quick links here.
      </p>
    </SidebarLayout>
  )
}

