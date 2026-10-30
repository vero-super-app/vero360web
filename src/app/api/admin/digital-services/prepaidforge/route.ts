import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { nestAdminFetch, nestAdminHeaders } from '@/lib/nest-admin'
import { apiErrorMessage, readJsonSafe, veroEndpoint } from '@/lib/vero-api'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const view = String(searchParams.get('view') || 'status').trim().toLowerCase()
  const skus = String(searchParams.get('skus') || '').trim()

  const segments =
    view === 'products'
      ? ['digital-services', 'prepaidforge', 'products']
      : view === 'stocks'
        ? ['digital-services', 'prepaidforge', 'stocks']
        : view === 'balance'
          ? ['digital-services', 'prepaidforge', 'balance']
          : ['digital-services', 'prepaidforge', 'status']

  try {
    if (view === 'stocks') {
      const url = `${veroEndpoint(...segments)}${
        skus ? `?skus=${encodeURIComponent(skus)}` : ''
      }`
      const res = await fetch(url, {
        headers: nestAdminHeaders(undefined, request),
        cache: 'no-store',
      })
      const body = await readJsonSafe(res)
      if (!res.ok) {
        return NextResponse.json(
          {
            success: false,
            error: apiErrorMessage(body, 'PrepaidForge backend unavailable'),
            stocks: [],
          },
          { status: 200 },
        )
      }
      return NextResponse.json(body)
    }

    const { res, body, error } = await nestAdminFetch(segments, undefined, request)
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          error: error || 'PrepaidForge backend unavailable',
          enabled: false,
          configured: false,
          products: [],
          stocks: [],
        },
        { status: res.status === 401 ? 401 : 200 },
      )
    }
    return NextResponse.json(body)
  } catch (err) {
    console.error('Admin prepaidforge proxy:', err)
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'PrepaidForge proxy failed',
      enabled: false,
      configured: false,
      products: [],
    })
  }
}
