'use client'

export default function PrivilegesPanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/privileges"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="User Privileges"
      />
    </div>
  )
}

