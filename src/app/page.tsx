'use client'

import SidebarLayout from './components/SidebarLayout'
import { useView } from './components/ViewContext'
import ProjectsPanel from './components/panels/ProjectsPanel'
import ManholesPanel from './components/panels/ManholesPanel'
import AddManholePanel from './components/panels/AddManholePanel'
import UsersPanel from './components/panels/UsersPanel'
import PrivilegesPanel from './components/panels/PrivilegesPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import StoragePanel from './components/panels/StoragePanel'
import MapViewPanel from './components/panels/MapViewPanel'
import RecyclePanel from './components/panels/RecyclePanel'
import ProjectOverviewCard from './components/dashboard/ProjectOverviewCard'
import SyncQueueCard from './components/dashboard/SyncQueueCard'

export default function HomePage() {
  const { view } = useView()

  return (
    <SidebarLayout>
      {view === 'dashboard' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-semibold mb-2">Dashboard</h1>
            <p className="text-gray-600">A quick overview of project progress and offline queue status.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProjectOverviewCard />
            <SyncQueueCard />
          </div>
        </div>
      )}

      {view === 'projects' && <ProjectsPanel />}
      {view === 'manholes' && <ManholesPanel />}
      {view === 'manholes_add' && <AddManholePanel />}
      {view === 'users' && <UsersPanel />}
      {view === 'privileges' && <PrivilegesPanel />}
      {view === 'settings' && <SettingsPanel />}
      {view === 'storage' && <StoragePanel />}
      {view === 'recycle' && <RecyclePanel />}
      {view === 'inspections' && <MapViewPanel />}
    </SidebarLayout>
  )
}
