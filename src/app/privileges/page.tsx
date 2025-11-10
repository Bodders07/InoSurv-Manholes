'use client'

import SidebarLayout from '@/app/components/SidebarLayout'

export default function PrivilegesPage() {
  return (
    <SidebarLayout>
      <h1 className="text-2xl font-bold mb-6">User Privileges</h1>

      <section className="bg-white border border-gray-200 rounded shadow-sm mb-6">
        <div className="px-4 py-3 border-b"><h2 className="font-semibold">Super Admin</h2></div>
        <ul className="p-4 list-disc list-inside text-gray-800 privileges-text">
          <li>Full access to all data and actions</li>
          <li>Invite users and change roles</li>
          <li>Delete any manhole or project (subject to DB policies)</li>
          <li>Bypasses standard restrictions via role policies</li>
        </ul>
      </section>

      <section className="bg-white border border-gray-200 rounded shadow-sm mb-6">
        <div className="px-4 py-3 border-b"><h2 className="font-semibold">Admin</h2></div>
        <ul className="p-4 list-disc list-inside text-gray-800 privileges-text">
          <li>Create, edit, and delete projects and manholes (where allowed)</li>
          <li>Access to admin pages (except changing roles)</li>
          <li>Invite users if enabled by policy</li>
        </ul>
      </section>

      <section className="bg-white border border-gray-200 rounded shadow-sm mb-6">
        <div className="px-4 py-3 border-b"><h2 className="font-semibold">Editor</h2></div>
        <ul className="p-4 list-disc list-inside text-gray-800 privileges-text">
          <li>Create and edit manholes</li>
          <li>Create and edit projects</li>
          <li>No user management or destructive admin actions</li>
        </ul>
      </section>

      <section className="bg-white border border-gray-200 rounded shadow-sm">
        <div className="px-4 py-3 border-b"><h2 className="font-semibold">Viewer</h2></div>
        <ul className="p-4 list-disc list-inside text-gray-800 privileges-text">
          <li>Read-only access to manholes and projects</li>
          <li>No create, edit, or delete permissions</li>
        </ul>
      </section>

      <p className="mt-6 text-sm text-gray-600 privileges-text">
        Note: Effective permissions also depend on database Row Level Security (RLS) policies. If an action is blocked,
        ensure your role policies are configured in Supabase to allow it.
      </p>
    </SidebarLayout>
  )
}
