'use client'

import { createContext, useContext } from 'react'
import type { ProjectSettings } from '@/lib/types'

const SettingsContext = createContext<ProjectSettings | null>(null)

export function SettingsProvider({
  value,
  children,
}: {
  value: ProjectSettings
  children: React.ReactNode
}) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): ProjectSettings {
  const settings = useContext(SettingsContext)
  if (!settings) throw new Error('Settings are not loaded')
  return settings
}
