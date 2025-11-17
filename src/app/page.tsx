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

export default function HomePage() {
  const { view } = useView()

  return (
    <SidebarLayout>
      {view === 'dashboard' && (
        <>
          <h1 className="text-3xl font-semibold mb-4">Dashboard</h1>
          <p className="text-gray-600">Welcome to your dashboard! Use the sidebar to navigate.</p>
        </>
      )}

      {view === 'projects' && <ProjectsPanel />}
      {view === 'manholes' && <ManholesPanel />}
      {view === 'manholes_add' && <AddManholePanel />}
      {view === 'users' && <UsersPanel />}
      {view === 'privileges' && <PrivilegesPanel />}
      {view === 'settings' && <SettingsPanel />}
      {view === 'storage' && <StoragePanel />}
      {view === 'inspections' && <MapViewPanel />}
    </SidebarLayout>
  )
}
