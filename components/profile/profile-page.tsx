'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/components/auth/auth-provider'

export function ProfileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth()
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>(open ? 'open' : 'closed')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (open) {
      setPhase('open')
      return
    }
    setPhase((current) => (current === 'closed' ? current : 'closing'))
  }, [open])

  useEffect(() => {
    if (phase !== 'closing') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setPhase('closed'), reduce ? 0 : 200)
    return () => window.clearTimeout(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  if (phase === 'closed' || !user) return null
  const state = phase === 'closing' ? 'closing' : 'open'
  const fields = [
    ['First name', user.firstName ?? ''],
    ['Last name', user.lastName ?? ''],
    ['Email', user.email ?? ''],
    ['Phone', user.phone ?? ''],
    ['ID / Passport', user.idPassportNumber ?? ''],
    ['Interested In', user.interestedIn ?? ''],
    ['Reason for buying', user.reasonForBuying ?? ''],
  ]

  return (
    <div className="profile-account-root fixed inset-0 z-[3200] flex items-center justify-center p-3 sm:p-6" data-state={state} role="dialog" aria-modal="true" aria-label="Account">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="profile-account relative flex max-h-[min(44rem,calc(100vh-1.5rem))] w-full max-w-[55rem] flex-col overflow-hidden rounded-xl border border-black/10 bg-white text-[#212126] shadow-[0_5px_15px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(0,0,0,0.2)] sm:flex-row">
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-md text-[#212126]/70 transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-black/[0.06] hover:text-[#212126]"
          aria-label="Close"
          onClick={onClose}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M17.658 6.343 6.344 17.657M17.658 17.657 6.344 6.343" />
          </svg>
        </button>
        <aside className="shrink-0 border-b border-black/[0.07] px-3 pb-4 pt-6 sm:w-[228px] sm:border-b-0 sm:border-r sm:pb-4 sm:pt-6">
          <div className="px-3 pr-10 sm:pr-3">
            <h2 className="text-2xl font-semibold leading-8">Account</h2>
            <p className="mt-1 text-[13px] leading-[18px] text-[#212126]/65">Manage your account info.</p>
          </div>
          <div className="mt-4 flex flex-col">
            <div className="group flex h-8 w-full items-center rounded-md bg-black/[0.07] px-3 text-[13px] font-medium text-[#2f3037]">
              Profile
              <svg className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" /></svg>
            </div>
            <button
              type="button"
              className="group mt-1 flex h-8 w-full items-center rounded-md px-3 text-left text-[13px] font-medium text-[#212126]/65 transition-colors duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-black/[0.04] hover:text-[#2f3037]"
              onClick={() => {
                setSigningOut(true)
                void logout()
              }}
            >
              {signingOut ? 'Ending session...' : 'Sign out'}
              <svg className="ml-auto h-4 w-4 shrink-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </aside>
        <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10 pt-6 sm:px-10">
          <h3 className="border-b border-black/[0.07] pb-4 text-[17px] font-bold leading-6">Profile details</h3>
          <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2">
            {fields.map(([label, value]) => (
              <DetailField key={label} label={label} value={value || '—'} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-medium text-[#212126]/65">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium text-[#212126]">{value}</p>
    </div>
  )
}
