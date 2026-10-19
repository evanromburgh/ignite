import { Suspense } from 'react'
import { HomePage } from '@/components/catalog/home-page'
import { getSiteMaps } from '@/lib/content'

export const dynamic = 'force-dynamic'

export default async function Page() {
  const maps = await getSiteMaps()
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#18181B]" />}>
      <HomePage maps={maps} />
    </Suspense>
  )
}
