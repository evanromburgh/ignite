'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User as SupabaseUser } from '@supabase/supabase-js'
import { errorMessageFromUnknown } from '@/lib/errors'
import { RESERVE_LOCK_EXPIRES_AT, RESERVE_TOKEN, RESERVE_UNIT_ID } from '@/lib/reserve'
import { browserSupabase } from '@/lib/supabase'
import type { AppUser } from '@/lib/types'

type AuthContextValue = {
  user: AppUser | null
  authLoading: boolean
  accessToken: string | null
  signUp: (input: SignUpInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
  signInWithOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  checkEmailExists: (email: string) => Promise<boolean>
}

type SignUpInput = {
  email: string
  password: string
  name: string
  firstName: string
  lastName: string
  phone: string
  idPassport: string
  reasonForBuying: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(supabaseUser: SupabaseUser | null): AppUser | null {
  if (!supabaseUser) return null
  const meta = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>
  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? null,
    displayName: (meta.display_name as string | undefined) ?? null,
    role: 'user',
    firstName: (meta.first_name as string | undefined) ?? null,
    lastName: (meta.last_name as string | undefined) ?? null,
    phone: (meta.phone as string | undefined) ?? null,
    idPassportNumber: null,
    reasonForBuying: null,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => browserSupabase(), [])
  const [user, setUser] = useState<AppUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const apply = (session: Session | null) => {
      setAccessToken(session?.access_token ?? null)
      const next = mapUser(session?.user ?? null)
      setUser(next)
      if (!next) return
      void supabase
        .from('profiles')
        .select('role, id_passport_number, reason_for_buying, first_name, last_name')
        .eq('id', next.id)
        .single()
        .then(({ data }) => {
          if (!active || !data) return
          setUser((current) => current && current.id === next.id ? {
            ...current,
            role: data.role === 'admin' ? 'admin' : 'user',
            idPassportNumber: (data.id_passport_number as string | null) ?? null,
            reasonForBuying: (data.reason_for_buying as string | null) ?? null,
            firstName: (data.first_name as string | null)?.trim() || current.firstName,
            lastName: (data.last_name as string | null)?.trim() || current.lastName,
          } : current)
        })
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session?.access_token) {
        const { data: userData, error } = await supabase.auth.getUser()
        if (!active) return
        if (error || !userData.user) {
          await supabase.auth.signOut()
          apply(null)
        } else {
          apply({ ...data.session, user: userData.user })
        }
      } else {
        apply(null)
      }
      setAuthLoading(false)
    }).catch(() => {
      if (active) setAuthLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      apply(session)
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    authLoading,
    accessToken,
    async signUp(input) {
      const { data, error } = await supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            display_name: input.name,
            first_name: input.firstName,
            last_name: input.lastName,
            phone: input.phone,
          },
        },
      })
      if (error) throw error
      if (data.user?.id) {
        await fetch('/api/auth/post-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            email: input.email,
            firstName: input.firstName,
            lastName: input.lastName,
            phone: input.phone,
            idPassport: input.idPassport,
            reasonForBuying: input.reasonForBuying,
          }),
        }).catch((err: unknown) => {
          console.warn('post-signup failed', errorMessageFromUnknown(err, 'post-signup failed'))
        })
      }
    },
    async login(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async logout() {
      const unitId = sessionStorage.getItem(RESERVE_UNIT_ID)
      if (accessToken && unitId) {
        await fetch('/api/units/release-lock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ unitId }),
        }).catch(() => undefined)
      }
      sessionStorage.removeItem(RESERVE_UNIT_ID)
      sessionStorage.removeItem(RESERVE_LOCK_EXPIRES_AT)
      sessionStorage.removeItem(RESERVE_TOKEN)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setUser(null)
      setAccessToken(null)
    },
    async resetPasswordForEmail(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` })
      if (error) throw error
    },
    async signInWithOtp(email) {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
      if (error) throw error
    },
    async verifyOtp(email, token) {
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      if (error) throw error
    },
    async checkEmailExists(email) {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Email lookup failed')
      }
      return Boolean(body.exists)
    },
  }), [accessToken, authLoading, supabase, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth is not available')
  return value
}
