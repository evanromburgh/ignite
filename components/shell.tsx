'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { initialsFromName } from '@/lib/format'
import { useAuth } from '@/components/auth/auth-provider'
import { PresenceBadge } from '@/components/presence'
import { ProfileDrawer } from '@/components/profile/profile-page'
import { useSettings } from '@/components/settings-context'
import { UrgencyStrip } from '@/components/urgency'

const AuthPortal = dynamic(() => import('@/components/auth/auth-portal').then((mod) => mod.AuthPortal), { ssr: false })

const NAV = [
  { href: '/', label: 'Properties' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/reservations', label: 'My Units' },
  { href: '/documents', label: 'Downloads' },
]

export function Shell({ children }: { children: ReactNode }) {
  const settings = useSettings()
  const { user, authLoading, logout } = useAuth()
  const pathname = usePathname()
  const [menu, setMenu] = useState<'closed' | 'open' | 'closing'>('closed')
  const [userMenu, setUserMenu] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [darkNav, setDarkNav] = useState(pathname === '/')
  const [scrolled, setScrolled] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    setMenu('closed')
    setProfileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (menu !== 'closing') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => setMenu('closed'), reduce ? 0 : 700)
    return () => window.clearTimeout(id)
  }, [menu])

  useEffect(() => {
    if (menu !== 'open') return
    const previous = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu('closing')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  function closeMenu() {
    setMenu((current) => (current === 'open' ? 'closing' : current))
  }

  function openProfile() {
    setUserMenu(false)
    setMenu('closed')
    setProfileOpen(true)
  }

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 20)
      if (pathname !== '/') {
        setDarkNav(false)
        return
      }
      const hero = document.querySelector<HTMLElement>('.nav-section.dark')
      const navHeight = document.querySelector('nav')?.clientHeight ?? 96
      if (!hero) {
        setDarkNav(true)
        return
      }
      setDarkNav(window.scrollY + navHeight <= hero.offsetTop + hero.offsetHeight)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    const timer = window.setInterval(() => {
      update()
      if (pathname !== '/' || document.querySelector('.nav-section.dark')) window.clearInterval(timer)
    }, 200)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      window.clearInterval(timer)
    }
  }, [pathname])

  if (authLoading) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#18181B] text-white">
        <img src={settings.logoLightUrl} alt={settings.brandName} className="h-7 w-auto sm:h-11" />
      </div>
    )
  }
  if (!user) return <AuthPortal />

  const linkClass = (active: boolean) => {
    if (darkNav) return active ? 'text-white font-semibold' : 'text-white font-normal'
    return active ? 'text-[#18181B] font-semibold' : 'text-[#18181B] font-normal'
  }
  const navBackground = scrolled
    ? 'bg-theme-overlay-nav/95 backdrop-blur-xl border-b border-white/10 shadow-sm'
    : pathname === '/'
      ? 'bg-transparent border-b border-transparent'
      : 'bg-transparent border-b border-theme-border'

  async function signOut() {
    setSigningOut(true)
    try { await logout() } finally { setSigningOut(false) }
  }

  return (
    <div className="min-h-screen bg-theme-bg text-theme-text-primary relative">
      <div className="min-h-screen flex flex-col">
        <nav className={`fixed top-0 left-0 right-0 z-[170] lg:z-[150] flex flex-col transition-all duration-300 ${navBackground} ${darkNav ? 'text-white' : 'text-[#18181B]'}`}>
          <div className="pl-5 pr-5 sm:pl-8 sm:pr-8 md:px-[5rem] h-16 sm:h-24 flex items-center justify-between">
            <Link href="/" className="flex items-center shrink-0" onClick={closeMenu}>
              <img src={darkNav ? settings.logoLightUrl : settings.logoDarkUrl} alt={settings.brandName} className="h-5 sm:h-6 w-auto" />
            </Link>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden lg:flex items-center space-x-10 mr-6">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={`h-[46px] px-2 text-[12px] uppercase tracking-[0.15em] transition-colors duration-500 flex items-center ${linkClass(pathname === item.href)}`}>{item.label}</Link>
                ))}
              </div>
              <div className="relative hidden lg:block">
                <button type="button" title="Profile Settings" className={`w-9 h-9 sm:w-[46px] sm:h-[46px] flex items-center justify-center rounded-full text-[10px] font-black transition-[background-color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${darkNav ? 'bg-white text-[#18181B]' : 'bg-[#18181B] text-white hover:bg-[#27272a]'}`} onClick={() => setUserMenu((value) => !value)}>{initialsFromName(user.displayName?.trim() || user.email || '', 2)}</button>
                {userMenu ? (
                  <div className="absolute top-full right-0 mt-3 sm:mt-[1.3rem] w-64 bg-theme-overlay-dropdown rounded-xl p-2 border border-theme-border shadow-xl z-[200]">
                    <button type="button" className="w-full flex items-center px-4 h-12 rounded-lg text-theme-text-muted hover:bg-zinc-100 hover:text-theme-text-primary transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] group mb-1" onClick={openProfile}>
                      <span className="text-[10px] font-black uppercase tracking-widest">My Profile</span>
                      <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-500 shrink-0" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6m2-3a2 2 0 1 1-4 0 2 2 0 0 1 4 0m4 8c0 1-1 1-1 1H3s-1 0-1-1 1-4 6-4 6 3 6 4m-1-.004c-.001-.246-.154-.986-.832-1.664C11.516 10.68 10.289 10 8 10s-3.516.68-4.168 1.332c-.678.678-.83 1.418-.832 1.664z" /></svg>
                    </button>
                    <div className="h-px bg-theme-border mx-2 my-1" />
                    <button type="button" className="w-full flex items-center px-4 h-12 rounded-lg text-theme-text-muted hover:bg-zinc-100 hover:text-theme-text-primary transition-[background-color,color] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] group" onClick={() => void signOut()}>
                      <span className="text-[10px] font-black uppercase tracking-widest">{signingOut ? 'Ending Session...' : 'Sign Out'}</span>
                      <svg className="w-4 h-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity duration-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                  </div>
                ) : null}
              </div>
              <button type="button" className="lg:hidden w-10 h-10 relative" aria-label="Menu" aria-expanded={menu === 'open'} onClick={() => setMenu('open')}>
                <span className={`absolute block w-5 h-0.5 left-2.5 top-[14px] ${darkNav ? 'bg-white' : 'bg-[#18181B]'}`} />
                <span className={`absolute block w-5 h-0.5 left-2.5 top-[19px] ${darkNav ? 'bg-white' : 'bg-[#18181B]'}`} />
                <span className={`absolute block w-5 h-0.5 left-2.5 top-[24px] ${darkNav ? 'bg-white' : 'bg-[#18181B]'}`} />
              </button>
            </div>
          </div>
        </nav>
        {menu !== 'closed' ? (
          <div className="lg:hidden fixed inset-0 z-[400]" role="dialog" aria-modal="true" aria-label="Menu">
            <button type="button" className="mobile-menu-overlay absolute inset-0 bg-black/40" data-state={menu === 'closing' ? 'closing' : 'open'} aria-label="Close menu" onClick={closeMenu} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
              <button type="button" className="mobile-menu-close pointer-events-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#18181B]" data-state={menu === 'closing' ? 'closing' : 'open'} aria-label="Close" onClick={closeMenu}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M17.658 6.343 6.344 17.657M17.658 17.657 6.344 6.343" /></svg>
              </button>
              <div className="mobile-menu-sheet pointer-events-auto flex h-[60vh] max-h-[75vh] w-full flex-col overflow-y-auto rounded-t-md bg-white px-6 pb-6 pt-6 text-[#1a1a1a]" data-state={menu === 'closing' ? 'closing' : 'open'}>
                <div className="flex flex-col gap-4">
                  {NAV.map((item) => <Link key={item.href} href={item.href} className="block text-[22px] font-semibold leading-[1.2] transition-colors duration-500" onClick={closeMenu}>{item.label}</Link>)}
                  <button type="button" className="block text-left text-[22px] font-semibold leading-[1.2] transition-colors duration-500" onClick={openProfile}>Profile</button>
                </div>
                <div className="mt-auto border-t border-[rgba(26,26,26,0.12)] pt-4">
                  <button type="button" className="text-xs font-bold leading-[1.6] text-[#1a1a1a] transition-colors duration-500" onClick={() => { closeMenu(); void signOut() }}>{signingOut ? 'Ending Session...' : 'Sign Out'}</button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
        <main className="w-full pt-0 pb-[4rem] sm:pb-0 flex-1">{children}</main>
        <PresenceBadge />
        <UrgencyStrip />
        <footer className="footer-main relative bg-[#18181B] text-white pl-5 pr-5 sm:pl-8 sm:pr-8 md:px-24 pt-16 sm:pt-20 pb-[4.25rem]">
          <div className="footer-content flex flex-col gap-14 lg:grid lg:grid-cols-2 lg:items-start lg:gap-20 pb-[4rem] sm:pb-16">
            <img src={settings.logoLightUrl} alt={settings.brandName} className="h-6 w-auto" />
            <div className="grid grid-cols-1 sm:grid-cols-[auto_auto_auto] gap-10 sm:gap-14 sm:justify-between">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider">Contact</h3>
                <a href={`mailto:${settings.footerContactEmail}`} className="block text-[12px] text-[#CCCCCC] hover:text-white transition-colors duration-500 leading-relaxed">{settings.footerContactEmail}</a>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider">Quick Links</h3>
                <nav className="flex flex-col gap-3">
                  <Link href="/wishlist" className="text-[12px] text-[#CCCCCC] hover:text-white transition-colors duration-500 leading-relaxed">Wishlist</Link>
                  <Link href="/reservations" className="text-[12px] text-[#CCCCCC] hover:text-white transition-colors duration-500 leading-relaxed">My Units</Link>
                  <Link href="/documents" className="text-[12px] text-[#CCCCCC] hover:text-white transition-colors duration-500 leading-relaxed">Downloads</Link>
                </nav>
              </div>
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider">Terms & Conditions</h3>
                <nav className="flex flex-col gap-3 text-[12px] text-[#CCCCCC]">
                  <span className="hover:text-white transition-colors duration-500 leading-relaxed cursor-pointer">Privacy Policy</span>
                  <span className="hover:text-white transition-colors duration-500 leading-relaxed cursor-pointer">Disclaimer</span>
                  <span className="hover:text-white transition-colors duration-500 leading-relaxed cursor-pointer">Cookie Settings</span>
                </nav>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 flex items-center justify-between pt-5 sm:pt-6">
            <p className="m-0 text-[12px] text-[#CCCCCC]">© {new Date().getFullYear()} {settings.brandName}. All rights reserved.</p>
            <button type="button" aria-label="Back to top" className="flex items-center justify-center w-10 h-10 rounded-full text-[#CCCCCC] hover:text-white hover:bg-white/10 transition-colors duration-500 shrink-0" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            </button>
          </div>
        </footer>
      </div>
      <ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  )
}
