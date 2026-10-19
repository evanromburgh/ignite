'use client'

import type { DocumentItem } from '@/lib/types'
import { useSettings } from '@/components/settings-context'

async function saveDocument(href: string) {
  const response = await fetch(href)
  if (!response.ok) return
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const match = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)
  link.href = objectUrl
  link.download = match?.[1] || 'download'
  link.click()
  URL.revokeObjectURL(objectUrl)
}

export function DocumentsPage({ documents }: { documents: DocumentItem[] }) {
  const settings = useSettings()
  return (
    <section className="px-4 sm:px-[5rem] pt-28 sm:pt-36 pb-20">
      <h1 className="text-3xl sm:text-5xl font-black tracking-tight">Downloads</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-600">{settings.documentsIntro}</p>
      <ul className="mt-10 grid gap-4">
        {documents.map((document) => (
          <li key={document.id} className="bg-white border border-theme-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{document.title}</h2>
              <p className="mt-1 text-sm text-zinc-600">{document.description}</p>
              <p className="mt-2 text-[11px] uppercase tracking-widest text-zinc-400">{[document.fileType, document.fileSize].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" onClick={() => void saveDocument(document.fileUrl)} className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-lg text-[11px] font-black uppercase tracking-[0.2em] bg-[#f4f4f5] text-zinc-800 hover:bg-[#18181B] hover:text-white transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] w-full sm:w-auto">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
