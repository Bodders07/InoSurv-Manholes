'use client'

export default function SettingsPanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/settings"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="Settings"
      />
    </div>
  )
}

