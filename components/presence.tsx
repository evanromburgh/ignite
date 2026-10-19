'use client'

import { useEffect, useState } from 'react'
import { browserSupabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'
import { EyeLottie } from '@/components/eye-lottie'

export function PresenceBadge() {
  const { user } = useAuth()
  const [onlineCount, setOnlineCount] = useState(1)

  useEffect(() => {
    const channel = browserSupabase().channel('site-presence', {
      config: { presence: { key: user?.id ?? crypto.randomUUID() } },
    })
    channel.on('presence', { event: 'sync' }, () => {
      setOnlineCount(Math.max(1, Object.keys(channel.presenceState()).length))
    })
    void channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
    })
    return () => {
      void channel.unsubscribe()
    }
  }, [user?.id])

  return (
    <div className="browsing-anchor" aria-live="polite">
      <div className="browsing-panel group">
        <div className="browsing-icon-button"><EyeLottie /></div>
        <div className="browsing-sep" />
        <div className="browsing-label">
          <span className="browsing-label-main">{onlineCount}</span>
          <span className="browsing-label-secondary">Users online</span>
        </div>
      </div>
    </div>
  )
}
