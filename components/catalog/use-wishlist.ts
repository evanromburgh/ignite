'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { browserSupabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'

type WishlistState = { ids: string[]; loading: boolean; error: string | null }
let state: WishlistState = { ids: [], loading: false, error: null }
const listeners = new Set<() => void>()

function emit(next: WishlistState) {
  state = next
  listeners.forEach((listener) => listener())
}

export function useWishlist() {
  const { user } = useAuth()
  const snapshot = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )

  useEffect(() => {
    if (!user?.id) {
      emit({ ids: [], loading: false, error: null })
      return
    }
    let active = true
    emit({ ...state, loading: true, error: null })
    void browserSupabase()
      .from('wishlists')
      .select('unit_id')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!active) return
        if (error) emit({ ids: [], loading: false, error: error.message })
        else emit({ ids: (data ?? []).map((row) => row.unit_id as string), loading: false, error: null })
      })
    return () => {
      active = false
    }
  }, [user?.id])

  const toggle = useCallback(async (unitId: string) => {
    if (!user?.id) return
    const exists = state.ids.includes(unitId)
    const supabase = browserSupabase()
    if (exists) {
      const { error } = await supabase.from('wishlists').delete().eq('user_id', user.id).eq('unit_id', unitId)
      if (error) {
        emit({ ...state, error: error.message })
        return
      }
      emit({ ...state, ids: state.ids.filter((id) => id !== unitId), error: null })
      return
    }
    const { error } = await supabase.from('wishlists').insert({ user_id: user.id, unit_id: unitId })
    if (error) {
      emit({ ...state, error: error.message })
      return
    }
    emit({ ...state, ids: state.ids.includes(unitId) ? state.ids : [...state.ids, unitId], error: null })
  }, [user?.id])

  return { ...snapshot, toggle }
}
