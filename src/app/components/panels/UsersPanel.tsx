'use client'

export default function UsersPanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/admin/users"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="User Management"
      />
    </div>
  )
}

