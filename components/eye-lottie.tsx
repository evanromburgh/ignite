'use client'

import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import eyeAnimation from '@/lib/dark-eye.json'

export function EyeLottie() {
  const container = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!container.current) return
    const animation = lottie.loadAnimation({
      container: container.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: eyeAnimation,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    animation.setSpeed(0.5)
    return () => animation.destroy()
  }, [])
  return <div ref={container} className="w-6 h-6" />
}
