'use client'

import { useEffect, useState } from 'react'
import { browserSupabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'

export function useReservedUnitIds() {
  const { user } = useAuth()
  const [ids, setIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) {
      setIds([])
      return
    }
    let active = true
    setLoading(true)
    void browserSupabase()
      .from('profiles')
      .select('reserved_unit_ids')
      .eq('id', user.id)
      .single()
      .then(({ data, error: queryError }) => {
        if (!active) return
        if (queryError) {
          setError(queryError.message)
          setIds([])
        } else {
          const value = data?.reserved_unit_ids
          setIds(Array.isArray(value) ? value as string[] : [])
          setError(null)
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user?.id])

  return { ids, loading, error }
}
