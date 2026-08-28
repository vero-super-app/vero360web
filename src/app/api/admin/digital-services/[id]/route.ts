import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  creditDigitalOrderPlatformFee,
  deleteDigitalServiceOrder,
  getDigitalServiceOrder,
  updateDigitalServiceOrderStatus,
} from '@/lib/digital-services-admin'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    const item = await getDigitalServiceOrder(id)
    if (!item) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin digital-services [id] GET:', err)
    return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
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
      startDate?: string | null
      endDate?: string | null
    }

    if (body.action === 'credit_platform_fee') {
      const result = await creditDigitalOrderPlatformFee(id)
      return NextResponse.json({ success: true, ...result })
    }

    const status = String(body.status || '').toLowerCase()
    if (
      status !== 'paid' &&
      status !== 'fulfilled' &&
      status !== 'cancelled' &&
      status !== 'pending_payment'
    ) {
      return NextResponse.json(
        {
          error:
            'Provide status: paid | fulfilled | cancelled | pending_payment, or action: credit_platform_fee',
        },
        { status: 400 },
      )
    }

    const item = await updateDigitalServiceOrderStatus(
      id,
      status as 'paid' | 'fulfilled' | 'cancelled' | 'pending_payment',
      {
        startDate: body.startDate !== undefined ? body.startDate : undefined,
        endDate: body.endDate !== undefined ? body.endDate : undefined,
      },
    )
    return NextResponse.json({ success: true, item })
  } catch (err) {
    console.error('Admin digital-services [id] PATCH:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update order' },
      { status: 400 },
    )
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const { id } = await ctx.params
    await deleteDigitalServiceOrder(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Admin digital-services [id] DELETE:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete order' },
      { status: 400 },
    )
  }
}
