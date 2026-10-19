'use client'

import { useParams } from 'next/navigation'
import { ReservePage } from '@/components/reserve/reserve-page'

export default function Page() {
  const params = useParams<{ unitNumber: string }>()
  return <ReservePage unitNumber={decodeURIComponent(params.unitNumber)} />
}
