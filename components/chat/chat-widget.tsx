'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { initialsFromName } from '@/lib/format'
import { browserSupabase } from '@/lib/supabase'
import type { AgentContact } from '@/lib/types'

type ChatPhase = 'off' | 'from' | 'in' | 'idle' | 'leave' | 'out'

function heroCleared() {
  const hero = document.querySelector('.nav-section.dark')
  if (!hero) return false
  const footer = document.querySelector('.footer-main')
  const footerTop = footer?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
  return hero.getBoundingClientRect().bottom < window.innerHeight && footerTop >= window.innerHeight
}

export function ChatWidget() {
  const [agents, setAgents] = useState<AgentContact[]>([])
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [phase, setPhase] = useState<ChatPhase>('off')
  const phaseRef = useRef<ChatPhase>('off')

  function move(next: ChatPhase) {
    if (phaseRef.current === next) return
    phaseRef.current = next
    setPhase(next)
  }

  useEffect(() => {
    void browserSupabase()
      .from('agents')
      .select('id, name, title, phone, email, image_url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        setAgents((data ?? []).map((row) => ({
          id: row.id as string,
          name: row.name as string,
          title: row.title as string,
          phone: row.phone as string,
          email: row.email as string,
          imageUrl: (row.image_url as string | null)?.trim() || undefined,
        })))
      })
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const show = heroCleared()
      const current = phaseRef.current
      if (show) {
        if (current === 'off' || current === 'leave' || current === 'out') move('from')
        return
      }
      if (current === 'from' || current === 'in' || current === 'idle') move('leave')
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

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
        if (phaseRef.current === 'out') move('off')
      }, 340)
      return () => window.clearTimeout(done)
    }
  }, [phase, agents.length])

  if (agents.length === 0 || phase === 'off') return null
  const selected = agents.find((agent) => agent.id === selectedId) ?? null
  const showPicker = agents.length > 1 && !selected
  const showBack = agents.length > 1 && selected !== null
  const digits = selected?.phone.replace(/\D/g, '') ?? ''

  function closeModal() {
    setOpen(false)
    setSelectedId(null)
  }

  const modal = (
    <div
      className="chat-widget__overlay"
      data-chat-backdrop=""
      onClick={(event) => {
        if ((event.target as HTMLElement).dataset.chatBackdrop !== undefined) closeModal()
      }}
    >
      <div className="chat-widget__modal" role="dialog" aria-modal="true" aria-labelledby="chat-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className={`chat-widget__modal-header ${showPicker ? 'chat-widget__modal-header--picker' : ''}`}>
          {showPicker ? null : (
            <div className="chat-widget__modal-header-slot chat-widget__modal-header-slot--start">
              {showBack ? (
                <button type="button" className="chat-widget__modal-back" aria-label="Back to agent list" onClick={() => setSelectedId(null)}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" /></svg>
                </button>
              ) : null}
            </div>
          )}
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
              <p className="chat-widget__prompt">Choose your preferred contact method:</p>
              <div className="chat-widget__actions">
                <a className="chat-widget__action" href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer">
                  <svg className="chat-widget__action-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                  WhatsApp
                </a>
                <a className="chat-widget__action" href={`mailto:${selected.email}`}>
                  <svg className="chat-widget__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                  Email
                </a>
                <a className="chat-widget__action" href={`tel:${selected.phone}`}>
                  <svg className="chat-widget__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  Phone Call
                </a>
              </div>
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
      {open ? createPortal(modal, document.body) : null}
    </div>
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
