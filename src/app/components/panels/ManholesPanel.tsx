'use client'

export default function ManholesPanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/manholes"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="Manholes"
      />
    </div>
  )
}

