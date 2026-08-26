import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import {
  buildAdvertCounts,
  createAdminHomepageAdvert,
  creditPendingAdvertPlatformFees,
  listHomepageAdverts,
  uploadHomepageAdvertImage,
} from '@/lib/homepage-adverts-admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const items = await listHomepageAdverts({ limit: 500 })
    const counts = buildAdvertCounts(items)
    return NextResponse.json({
      success: true,
      items,
      counts,
    })
  } catch (err) {
    console.error('Admin homepage-adverts GET:', err)
    return NextResponse.json({ error: 'Failed to load homepage adverts' }, { status: 500 })
  }
}

/**
 * POST multipart — complimentary admin create (no payment).
 * POST JSON { action: 'credit_pending_fees' } — credit paid advert fees.
 */
export async function POST(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const title = String(form.get('title') ?? '')
      const description = String(form.get('description') ?? '')
      const category = String(form.get('category') ?? '')
      const planId = String(form.get('planId') ?? '')
      const durationHoursRaw = String(form.get('durationHours') ?? '').trim()
      const productPriceRaw = String(form.get('productPrice') ?? '').trim()
      const ownerName = String(form.get('ownerName') ?? '')
      const ownerEmail = String(form.get('ownerEmail') ?? '')
      const ownerPhone = String(form.get('ownerPhone') ?? '')
      const file = form.get('image')

      if (!(file instanceof File) || file.size <= 0) {
        return NextResponse.json({ error: 'A photo upload is required' }, { status: 400 })
      }

      const imageUrl = await uploadHomepageAdvertImage(file)
      const item = await createAdminHomepageAdvert({
        title,
        description,
        imageUrl,
        category,
        planId,
        durationHours: durationHoursRaw ? Number(durationHoursRaw) : undefined,
        productPrice: productPriceRaw ? Number(productPriceRaw) : null,
        ownerName,
        ownerEmail,
        ownerPhone,
        ownerUid: 'admin',
      })
      return NextResponse.json({ success: true, item }, { status: 201 })
    }

    const body = (await request.json().catch(() => ({}))) as { action?: string }
    if (body.action !== 'credit_pending_fees') {
      return NextResponse.json(
        {
          error:
            'Unsupported action. Use multipart form to create a free ad, or action: credit_pending_fees',
        },
        { status: 400 },
      )
    }

    const result = await creditPendingAdvertPlatformFees()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('Admin homepage-adverts POST:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process homepage advert request' },
      { status: 500 },
    )
  }
}
