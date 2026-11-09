'use client'

import { useSyncExternalStore } from 'react'

type ToastState = { id: number; message: string } | null

let toast: ToastState = null
let nextId = 0
let hideTimer = 0
const listeners = new Set<() => void>()

function emit(next: ToastState) {
  toast = next
  listeners.forEach((listener) => listener())
}

export function showToast(message: string) {
  window.clearTimeout(hideTimer)
  emit({ id: ++nextId, message })
  hideTimer = window.setTimeout(() => emit(null), 4000)
}

export function dismissToast() {
  window.clearTimeout(hideTimer)
  emit(null)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function ToastHost() {
  const current = useSyncExternalStore(subscribe, () => toast, () => null)
  if (!current) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-14 z-[5200] flex justify-center px-4">
      <p role="status" className="pointer-events-auto w-fit max-w-full rounded-lg bg-[#18181B] px-12 py-5 text-center text-sm font-semibold leading-none text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">{current.message}</p>
    </div>
  )
}
