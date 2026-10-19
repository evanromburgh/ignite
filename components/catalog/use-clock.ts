'use client'

import { useEffect, useState } from 'react'

export function useServerClock() {
  const [offsetMs, setOffsetMs] = useState(0)
  useEffect(() => {
    let active = true
    const sync = async () => {
      try {
        const response = await fetch('/api/server-time')
        const body = await response.json()
        if (active && typeof body.serverTimeMs === 'number') setOffsetMs(body.serverTimeMs - Date.now())
      } catch {
        // Keep the previous offset.
      }
    }
    void sync()
    const id = window.setInterval(() => void sync(), 60_000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [])
  return offsetMs
}

export function useLockCountdown(expiresAt: number | undefined, offsetMs: number) {
  const [timeLeft, setTimeLeft] = useState(0)
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(0)
      return
    }
    const update = () => setTimeLeft(Math.max(0, Math.floor((expiresAt - (Date.now() + offsetMs)) / 1000)))
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [expiresAt, offsetMs])
  return timeLeft
}
