'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { publicEnv } from '@/lib/env'
import { browserSupabase } from '@/lib/supabase'
import { insertSortedUnit, mapUnitRow, sortUnitsByUnitNumber } from '@/lib/units'
import type { Unit, UnitRow } from '@/lib/types'
import { useSettings } from '@/components/settings-context'

type UnitsState = { units: Unit[]; loading: boolean; error: string | null }

let state: UnitsState = { units: [], loading: true, error: null }
const listeners = new Set<() => void>()
let started = false

function emit(next: UnitsState) {
  state = next
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useUnits() {
  const settings = useSettings()
  const snapshot = useSyncExternalStore(subscribe, () => state, () => state)

  useEffect(() => {
    if (started) return
    started = true
    const { url } = publicEnv()
    const supabase = browserSupabase()
    const mapRow = (row: UnitRow) => mapUnitRow(row, url, settings.presenceTtlMs)
    void supabase
      .from('units')
      .select('*')
      .order('unit_number', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          emit({ units: [], loading: false, error: error.message })
          return
        }
        emit({
          units: ((data ?? []) as UnitRow[]).map(mapRow).sort(sortUnitsByUnitNumber),
          loading: false,
          error: null,
        })
      })

    const channel = supabase
      .channel('units-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, (payload) => {
        const newRow = payload.new as UnitRow
        const oldRow = payload.old as { id?: string }
        if (payload.eventType === 'INSERT' && newRow?.id) {
          emit({ ...state, units: insertSortedUnit(state.units, mapRow(newRow)) })
        } else if (payload.eventType === 'UPDATE' && newRow?.id) {
          const mapped = mapRow(newRow)
          const index = state.units.findIndex((unit) => unit.id === mapped.id)
          const without = index === -1 ? state.units : state.units.filter((_, itemIndex) => itemIndex !== index)
          emit({ ...state, units: insertSortedUnit(without, mapped) })
        } else if (payload.eventType === 'DELETE' && oldRow?.id) {
          emit({ ...state, units: state.units.filter((unit) => unit.id !== oldRow.id) })
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
      started = false
    }
  }, [settings.presenceTtlMs])

  return snapshot
}
