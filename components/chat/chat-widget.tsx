'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/auth/auth-provider'
import { AgentContactMethods } from '@/components/chat/agent-contact-methods'
import { agentContactFromRow } from '@/lib/assigned-agent'
import { initialsFromName } from '@/lib/format'
import { browserSupabase } from '@/lib/supabase'
import type { AgentContact } from '@/lib/types'

const OWNER_RETRY_MS = [4_000, 8_000, 16_000]

type ChatPhase = 'off' | 'from' | 'in' | 'idle' | 'leave' | 'out'

function heroCleared() {
  const hero = document.querySelector('.nav-section.dark')
  if (!hero) return false
  const footer = document.querySelector('.footer-main')
  const footerTop = footer?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
  return hero.getBoundingClientRect().bottom < window.innerHeight && footerTop > window.innerHeight
}

export function ChatWidget() {
  const { user, accessToken } = useAuth()
  const userId = user?.id ?? null
  const [agents, setAgents] = useState<AgentContact[]>([])
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const openRef = useRef(false)
  const closingRef = useRef(false)
  openRef.current = open
  closingRef.current = closing
  const [phase, setPhase] = useState<ChatPhase>('off')
  const phaseRef = useRef<ChatPhase>('off')

  function move(next: ChatPhase) {
    if (phaseRef.current === next) return
    phaseRef.current = next
    setPhase(next)
  }

  useEffect(() => {
    setAgents([])
    setSelectedId(null)
    setOpen(false)
    setClosing(false)
  }, [userId])

  useEffect(() => {
    if (!closing) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setTimeout(() => {
      setOpen(false)
      setClosing(false)
      setSelectedId(null)
    }, reduce ? 0 : 250)
    return () => window.clearTimeout(id)
  }, [closing])

  useEffect(() => {
    if (!userId || !accessToken) return
    let cancelled = false
    let timer = 0

    const loadSaved = async (): Promise<'found' | 'final' | 'pending'> => {
      const profile = await browserSupabase()
        .from('profiles')
        .select('agent_id')
        .eq('id', userId)
        .maybeSingle()
      if (profile.error) return 'pending'
      const agentId = typeof profile.data?.agent_id === 'string' ? profile.data.agent_id.trim() : ''
      if (!agentId) return 'pending'
      const agent = await browserSupabase()
        .from('agents')
        .select('id, name, title, phone, email, image_url')
        .eq('id', agentId)
        .eq('is_active', true)
        .maybeSingle()
      const contact = agentContactFromRow(agent.data)
      if (agent.error || !contact) return 'pending'
      if (!cancelled) setAgents([contact])
      return 'found'
    }

    const resolveRemote = async (): Promise<'found' | 'final' | 'pending'> => {
      try {
        const response = await fetch('/api/agent', {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: 'no-store',
        })
        if (response.status === 502) return 'pending'
        if (!response.ok) return 'final'
        const body = await response.json().catch(() => null) as { agent?: unknown; pending?: unknown } | null
        const contact = agentContactFromRow(body?.agent)
        if (contact) {
          if (!cancelled) setAgents([contact])
          return 'found'
        }
        return body?.pending === true ? 'pending' : 'final'
      } catch {
        return 'pending'
      }
    }

    const run = async (retry: number) => {
      const saved = await loadSaved()
      if (cancelled || saved !== 'pending') return
      const resolved = await resolveRemote()
      if (cancelled || resolved !== 'pending') return
      const delay = OWNER_RETRY_MS[retry]
      if (delay === undefined) return
      timer = window.setTimeout(() => { void run(retry + 1) }, delay)
    }

    void run(0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [userId, accessToken])

  useEffect(() => {
    const onScroll = () => {
      const show = heroCleared()
      const current = phaseRef.current
      if (show) {
        if (current === 'off' || current === 'leave' || current === 'out') move('from')
        return
      }
      if (openRef.current && !closingRef.current) setClosing(true)
      if (current === 'from' || current === 'in' || current === 'idle') move('leave')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [agents.length])

  useLayoutEffect(() => {
    if (agents.length === 0) return
    if (phase === 'from') {
      document.querySelector('.chat-widget')?.getBoundingClientRect()
      let inner = 0
      const go = () => {
        if (phaseRef.current === 'from') move('in')
      }
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(go)
      })
      const fallback = window.setTimeout(go, 100)
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
        window.clearTimeout(fallback)
      }
    }
    if (phase === 'in') {
      const done = window.setTimeout(() => {
        if (phaseRef.current === 'in') move('idle')
      }, 300)
      return () => window.clearTimeout(done)
    }
    if (phase === 'leave' || phase === 'out') {
      if (phase === 'leave') {
        let inner = 0
        const go = () => {
          if (phaseRef.current === 'leave') move('out')
        }
        const outer = requestAnimationFrame(() => {
          inner = requestAnimationFrame(go)
        })
        const fallback = window.setTimeout(go, 32)
        return () => {
          cancelAnimationFrame(outer)
          cancelAnimationFrame(inner)
          window.clearTimeout(fallback)
        }
      }
      const done = window.setTimeout(() => {
        if (phaseRef.current !== 'out') return
        move(heroCleared() ? 'from' : 'off')
      }, 340)
      return () => window.clearTimeout(done)
    }
  }, [phase, agents.length])

  if (agents.length === 0 || (phase === 'off' && !open)) return null
  const selected = agents.find((agent) => agent.id === selectedId) ?? null
  const showPicker = agents.length > 1 && !selected
  const showBack = agents.length > 1 && selected !== null

  function closeModal() {
    if (!open || closing) return
    setClosing(true)
  }

  const modal = (
    <div
      className={`chat-widget__overlay${closing ? ' chat-widget__overlay--closing' : ''}`}
      data-chat-backdrop=""
      onClick={(event) => {
        if ((event.target as HTMLElement).dataset.chatBackdrop !== undefined) closeModal()
      }}
    >
      <div className="chat-widget__modal" role="dialog" aria-modal="true" aria-labelledby="chat-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className={`chat-widget__modal-header ${showPicker ? 'chat-widget__modal-header--picker' : ''}`}>
          {showBack ? (
            <div className="chat-widget__modal-header-slot chat-widget__modal-header-slot--start">
              <button type="button" className="chat-widget__modal-back" aria-label="Back to agent list" onClick={() => setSelectedId(null)}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
              </button>
            </div>
          ) : null}
          <h2 id="chat-modal-title" className={`chat-widget__modal-title ${showPicker ? 'chat-widget__modal-title--picker' : ''}`}>Contact your agent</h2>
          <div className="chat-widget__modal-header-slot chat-widget__modal-header-slot--end">
            <button type="button" className="chat-widget__modal-close" aria-label="Close" onClick={closeModal}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
        <div className="chat-widget__modal-body">
          {showPicker ? (
            <div className="chat-widget__pick">
              <ul className="chat-widget__pick-list" role="list">
                {agents.map((agent) => (
                  <li key={agent.id}>
                    <button type="button" className="chat-widget__pick-item" onClick={() => setSelectedId(agent.id)}>
                      <AgentAvatar agent={agent} size="pick" />
                      <span className="chat-widget__pick-text">
                        <span className="chat-widget__pick-name">{agent.name}</span>
                        <span className="chat-widget__pick-title">{agent.title}</span>
                      </span>
                      <span className="chat-widget__pick-chevron" aria-hidden="true">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l6 6-6 6" /></svg>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : selected ? (
            <>
              <div className="chat-widget__agent">
                <AgentAvatar agent={selected} size="profile" />
                <p className="chat-widget__agent-name">{selected.name}</p>
                <div className="chat-widget__agent-details">
                  <a className="chat-widget__agent-detail" href={`mailto:${selected.email}`}>
                    <svg className="chat-widget__detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                    {selected.email}
                  </a>
                  <a className="chat-widget__agent-detail" href={`tel:${selected.phone}`}>
                    <svg className="chat-widget__detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                    {selected.phone}
                  </a>
                </div>
              </div>
              <AgentContactMethods email={selected.email} phone={selected.phone} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )

  const presence = phase === 'from'
    ? 'chat-widget-appear-enter-from chat-widget-appear-enter-active'
    : phase === 'in'
      ? 'chat-widget-appear-enter-active chat-widget-appear-enter-to'
      : phase === 'leave'
        ? 'chat-widget-appear-leave-from chat-widget-appear-leave-active'
        : phase === 'out'
          ? 'chat-widget-appear-leave-active chat-widget-appear-leave-to'
          : ''

  return (
    <>
      {phase === 'off' ? null : (
        <div className={`chat-widget ${presence} ${open ? 'chat-widget--modal-open' : ''}`}>
          <button
            type="button"
            className="chat-widget__button"
            aria-label={open ? 'Close contact modal' : 'Contact your agent'}
            onClick={() => {
              if (open) closeModal()
              else {
                setSelectedId(agents.length === 1 ? agents[0].id : null)
                setOpen(true)
              }
            }}
          >
            <svg className="chat-widget__icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M14 1a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-2.5a2 2 0 0 0-1.6.8L8 14.333 6.1 11.8a2 2 0 0 0-1.6-.8H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1zM2 0a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5a1 1 0 0 1 .8.4l1.9 2.533a1 1 0 0 0 1.6 0l1.9-2.533a1 1 0 0 1 .8-.4H14a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z" />
            </svg>
          </button>
        </div>
      )}
      {open ? createPortal(modal, document.body) : null}
    </>
  )
}

function AgentAvatar({ agent, size }: { agent: AgentContact; size: 'pick' | 'profile' }) {
  const initials = <span className={`chat-widget__agent-initials ${size === 'pick' ? 'chat-widget__pick-initials' : ''}`}>{initialsFromName(agent.name, 3)}</span>
  if (size === 'pick') {
    return (
      <span className="chat-widget__pick-avatar">
        {agent.imageUrl ? <img src={agent.imageUrl} alt={agent.name} className="chat-widget__agent-img" /> : initials}
      </span>
    )
  }
  return (
    <div className="chat-widget__agent-avatar">
      {agent.imageUrl ? <img src={agent.imageUrl} alt={agent.name} className="chat-widget__agent-img" /> : initials}
    </div>
  )
}
