'use client'

export default function AddManholePanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/manholes/add?embed=1"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="Add Manhole"
      />
    </div>
  )
}
