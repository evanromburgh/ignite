'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AuthChangeEvent, AuthError, Session, User as SupabaseUser } from '@supabase/supabase-js'
import { errorMessageFromUnknown } from '@/lib/errors'
import { RESERVE_LOCK_EXPIRES_AT, RESERVE_TOKEN, RESERVE_UNIT_ID } from '@/lib/reserve'
import { browserSupabase } from '@/lib/supabase'
import type { AppUser } from '@/lib/types'

type AuthContextValue = {
  user: AppUser | null
  authLoading: boolean
  accessToken: string | null
  signUp: (input: SignUpInput) => Promise<'created' | 'exists' | 'confirm'>
  completeProfile: (input: CompleteProfileInput) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  resetPasswordForEmail: (email: string) => Promise<void>
}

type CompleteProfileInput = {
  email: string
  password: string
  name: string
  firstName: string
  lastName: string
  phone: string
  idPassport: string
  interestedIn: string
  reasonForBuying: string
}

type SignUpInput = CompleteProfileInput & {
  password: string
}

const AuthContext = createContext<AuthContextValue | null>(null)

function accountAlreadyExists(error: { message: string; code?: string }) {
  const message = error.message.toLowerCase()
  return error.code === 'user_already_exists'
    || message.includes('already registered')
    || message.includes('already been registered')
    || message.includes('user already exists')
}

function textOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function googleNames(meta: Record<string, unknown>) {
  const given = textOrNull(meta.given_name) ?? textOrNull(meta.first_name)
  const family = textOrNull(meta.family_name) ?? textOrNull(meta.last_name)
  if (given || family) return { firstName: given, lastName: family }
  const full = textOrNull(meta.full_name) ?? textOrNull(meta.name) ?? textOrNull(meta.display_name)
  if (!full) return { firstName: null, lastName: null }
  const [firstName, ...rest] = full.split(/\s+/)
  return { firstName: firstName ?? null, lastName: rest.join(' ') || null }
}

function isGoogleAccount(supabaseUser: SupabaseUser) {
  const app = (supabaseUser.app_metadata ?? {}) as { provider?: string; providers?: string[] }
  return app.provider === 'google' || Boolean(app.providers?.includes('google'))
}

function profileIsComplete(user: Pick<AppUser, 'firstName' | 'lastName' | 'phone' | 'idPassportNumber' | 'interestedIn' | 'reasonForBuying'>) {
  return Boolean(user.firstName?.trim() && user.lastName?.trim() && user.phone?.trim() && user.idPassportNumber?.trim() && user.interestedIn?.trim() && user.reasonForBuying?.trim())
}

function syncSignup(userId: string, input: CompleteProfileInput, token?: string | null) {
  return fetch('/api/auth/post-signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      idPassport: input.idPassport,
      interestedIn: input.interestedIn,
      reasonForBuying: input.reasonForBuying,
    }),
  }).catch((err: unknown) => {
    console.warn('post-signup failed', errorMessageFromUnknown(err, 'post-signup failed'))
  })
}

function retryableAuthError(error: AuthError | null) {
  if (!error) return false
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return true
  const message = error.message.toLowerCase()
  return message.includes('fetch') || message.includes('network') || message.includes('timeout')
}

function mapUser(supabaseUser: SupabaseUser | null): AppUser | null {
  if (!supabaseUser) return null
  const meta = (supabaseUser.user_metadata ?? {}) as Record<string, unknown>
  const names = googleNames(meta)
  const googleAccount = isGoogleAccount(supabaseUser)
  const next = {
    id: supabaseUser.id,
    email: supabaseUser.email ?? textOrNull(meta.email),
    displayName: textOrNull(meta.display_name) ?? textOrNull(meta.full_name) ?? textOrNull(meta.name),
    role: 'user' as const,
    firstName: names.firstName,
    lastName: names.lastName,
    phone: textOrNull(meta.phone) ?? textOrNull(meta.phone_number),
    idPassportNumber: null,
    interestedIn: null,
    reasonForBuying: null,
    googleAccount,
    signupIncomplete: false,
  }
  return { ...next, signupIncomplete: googleAccount && !profileIsComplete(next) }
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
      setUser((current) => {
        if (!next) return null
        if (!current || current.id !== next.id) return next
        return {
          ...next,
          role: current.role,
          firstName: current.firstName || next.firstName,
          lastName: current.lastName || next.lastName,
          phone: current.phone || next.phone,
          idPassportNumber: current.idPassportNumber,
          interestedIn: current.interestedIn,
          reasonForBuying: current.reasonForBuying,
          signupIncomplete: current.signupIncomplete,
        }
      })
      if (!next) return Promise.resolve()
      const profile = supabase
        .from('profiles')
        .select('role, id_passport_number, interested_in, reason_for_buying, first_name, last_name, phone')
        .eq('id', next.id)
        .single()
        .then(({ data }) => {
          if (!active || !data) return
          setUser((current) => {
            if (!current || current.id !== next.id) return current
            const merged = {
              ...current,
              role: data.role === 'admin' ? 'admin' as const : 'user' as const,
              idPassportNumber: (data.id_passport_number as string | null) ?? null,
              interestedIn: (data.interested_in as string | null) ?? null,
              reasonForBuying: (data.reason_for_buying as string | null) ?? null,
              firstName: (data.first_name as string | null)?.trim() || current.firstName,
              lastName: (data.last_name as string | null)?.trim() || current.lastName,
              phone: (data.phone as string | null)?.trim() || current.phone,
            }
            return { ...merged, signupIncomplete: merged.googleAccount && !profileIsComplete(merged) }
          })
        })
      return profile.then(() => undefined)
    }

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session?.access_token) {
        const { data: userData, error } = await supabase.auth.getUser()
        if (!active) return
        if (userData.user) {
          await apply({ ...data.session, user: userData.user })
        } else if (retryableAuthError(error)) {
          await apply(data.session)
        } else {
          await supabase.auth.signOut()
          await apply(null)
        }
      } else {
        await apply(null)
      }
      setAuthLoading(false)
    }).catch(() => {
      if (active) setAuthLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      if (!session?.user) {
        if (event === 'SIGNED_OUT') apply(null)
        return
      }
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
      if (error) {
        if (accountAlreadyExists(error)) return 'exists'
        throw error
      }
      const identities = data.user?.identities
      if (data.user && Array.isArray(identities) && identities.length === 0) return 'exists'
      if (data.user?.id) await syncSignup(data.user.id, input, data.session?.access_token)
      if (!data.session) return 'confirm'
      return 'created'
    },
    async completeProfile(input) {
      if (!user) throw new Error('Sign in with Google before completing your details.')
      const { error } = await supabase.from('profiles').update({
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        id_passport_number: input.idPassport,
        interested_in: input.interestedIn,
        reason_for_buying: input.reasonForBuying,
      }).eq('id', user.id)
      if (error) throw error
      const { error: userError } = await supabase.auth.updateUser({
        password: input.password,
        data: {
          display_name: input.name,
          first_name: input.firstName,
          last_name: input.lastName,
          phone: input.phone,
        },
      })
      if (userError) throw userError
      setUser((current) => current && current.id === user.id ? {
        ...current,
        email: input.email,
        displayName: input.name,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        idPassportNumber: input.idPassport,
        interestedIn: input.interestedIn,
        reasonForBuying: input.reasonForBuying,
        signupIncomplete: false,
      } : current)
      await syncSignup(user.id, input, accessToken)
    },
    async login(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInWithGoogle() {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          scopes: 'openid email profile',
        },
      })
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
  }), [accessToken, authLoading, supabase, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('Auth is not available')
  return value
}
