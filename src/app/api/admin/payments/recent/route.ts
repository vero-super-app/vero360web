import { NextResponse } from 'next/server'
import { denyUnlessPanelAdmin } from '@/lib/admin-auth'
import { listDigitalServiceOrders } from '@/lib/digital-services-admin'
import { listHomepageAdverts } from '@/lib/homepage-adverts-admin'

export const dynamic = 'force-dynamic'

/**
 * Lightweight poll for newly paid digital services + homepage ads
 * (admin badges / browser notifications).
 */
export async function GET(request: Request) {
  const denied = await denyUnlessPanelAdmin(request)
  if (denied) return denied

  try {
    const [digitalAll, adsAll] = await Promise.all([
      listDigitalServiceOrders({ limit: 200 }),
      listHomepageAdverts({ limit: 200 }),
    ])

    const digital = digitalAll
      .filter(
        o =>
          o.amountMwk > 0 &&
          (o.status === 'paid' || o.status === 'fulfilled' || Boolean(o.paidAt)),
      )
      .sort((a, b) => {
        const at = a.paidAt ? new Date(a.paidAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.paidAt ? new Date(b.paidAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
      .slice(0, 40)
      .map(o => ({
        id: o.id,
        kind: 'digital' as const,
        title: o.productName,
        amountMwk: o.amountMwk,
        buyerName: o.buyerName,
        buyerEmail: o.buyerEmail,
        paidAt: o.paidAt || o.createdAt,
      }))

    const homepageAds = adsAll
      .filter(
        a =>
          a.amountPaid > 0 &&
          (a.status === 'active' || Boolean(a.paidAt) || a.platformFeeCredited),
      )
      .sort((a, b) => {
        const at = a.paidAt ? new Date(a.paidAt).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0
        const bt = b.paidAt ? new Date(b.paidAt).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0
        return bt - at
      })
      .slice(0, 40)
      .map(a => ({
        id: a.id,
        kind: 'homepage_ad' as const,
        title: a.title,
        amountMwk: a.amountPaid,
        buyerName: a.ownerName,
        buyerEmail: a.ownerEmail,
        paidAt: a.paidAt || a.createdAt,
      }))

    return NextResponse.json({
      success: true,
      digital,
      homepageAds,
      digitalIds: digital.map(d => d.id),
      homepageAdIds: homepageAds.map(a => a.id),
      digitalCount: digital.length,
      homepageAdCount: homepageAds.length,
      latestDigital: digital[0] || null,
      latestHomepageAd: homepageAds[0] || null,
    })
  } catch (err) {
    console.error('Admin payments recent GET:', err)
    return NextResponse.json({ error: 'Could not load recent payments' }, { status: 502 })
  }
}
