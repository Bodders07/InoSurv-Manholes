'use client'

export default function ProjectsPanel() {
  return (
    <div className="h-full w-full">
      <iframe
        src="/projects"
        className="w-full h-[calc(100vh-140px)] border-0 rounded"
        title="Projects"
      />
    </div>
  )
}

