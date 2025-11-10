'use client'

export default function AddManholePanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/manholes/add"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="Add Manhole"
      />
    </div>
  )
}
