import { NextResponse } from 'next/server'
import { resolvePublicUrl } from '@/lib/assets'
import { publicEnv } from '@/lib/env'
import { createAnonClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const documentIdPattern = /^[a-z0-9-]{1,80}$/

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!documentIdPattern.test(id)) return new NextResponse('Not found', { status: 404 })

  const supabase = createAnonClient()
  const { data, error } = await supabase
    .from('documents')
    .select('file_path')
    .eq('id', id)
    .eq('published', true)
    .maybeSingle()
  const filePath = typeof data?.file_path === 'string' ? data.file_path : ''
  if (error || !filePath.startsWith('downloads/')) return new NextResponse('Not found', { status: 404 })

  const { url } = publicEnv()
  const upstream = await fetch(resolvePublicUrl(url, filePath))
  if (!upstream.ok || !upstream.body) return new NextResponse('Not found', { status: 404 })

  const filename = filePath.split('/').pop()?.replace(/[^a-zA-Z0-9._-]/g, '') || 'download'
  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
