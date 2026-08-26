import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  creditAdvertPlatformFee,
  deleteHomepageAdvert,
  getHomepageAdvert,
  updateHomepageAdvertStatus,
} from '@/lib/homepage-adverts-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    const item = await getHomepageAdvert(id)
    if (!item) return NextResponse.json({ error: 'Advert not found' }, { status: 404 })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin homepage-adverts [id] GET:', err)
    return NextResponse.json({ error: 'Failed to load advert' }, { status: 500 })
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      status?: string
    }

    if (body.action === 'credit_platform_fee') {
      const result = await creditAdvertPlatformFee(id)
      return NextResponse.json({ success: true, ...result })
    }

    const status = String(body.status || body.action || '').toLowerCase()
    if (status !== 'active' && status !== 'disabled' && status !== 'expired') {
      return NextResponse.json(
        {
          error:
            'Provide status: active | disabled | expired, or action: credit_platform_fee',
        },
        { status: 400 },
      )
    }

    const item = await updateHomepageAdvertStatus(
      id,
      status as 'active' | 'disabled' | 'expired',
    )
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin homepage-adverts [id] PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update advert' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    await deleteHomepageAdvert(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin homepage-adverts [id] DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete advert' },
      { status: 400 },
    )
  }
}
