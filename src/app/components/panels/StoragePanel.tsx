'use client'

export default function StoragePanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/admin/storage?embed=1"
        title="Storage Usage"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
      />
    </div>
  )
}

