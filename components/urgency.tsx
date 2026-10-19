'use client'

import { useSyncExternalStore } from 'react'

let message = ''
let visible = false
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function showUrgency(text: string) {
  message = text
  visible = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    visible = false
    timer = null
    emit()
  }, 5000)
  emit()
}

export function UrgencyStrip() {
  const open = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => visible,
    () => false,
  )
  if (!open) return null
  return (
    <div className="fixed left-1/2 z-[215] w-max max-w-[calc(100vw-2.5rem)] -translate-x-1/2 rounded-xl bg-[#922724] px-4 py-3 text-center text-white shadow-lg bottom-5" role="alert">
      <p className="text-[11px] font-semibold leading-snug">{message}</p>
    </div>
  )
}
