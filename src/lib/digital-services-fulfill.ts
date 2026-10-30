import 'server-only'

import { nestAdminFetch } from '@/lib/nest-admin'
import { isAutoFulfillOrder } from '@/lib/digital-services-prepaidforge'

/** Fire-and-forget Nest auto-fulfill. Never throws; payment must not depend on this. */
export function kickDigitalOrderAutoFulfill(orderId: string, data?: {
  fulfillmentMode?: unknown
}): void {
  const id = String(orderId || '').trim()
  if (!id) return
  if (data && !isAutoFulfillOrder(data)) return
  void (async () => {
    try {
      const ctrl = AbortSignal.timeout(3000)
      await nestAdminFetch(
        ['digital-services', 'fulfill', id],
        { method: 'POST', signal: ctrl },
      )
    } catch {
      // Poller retries. Do not fail PawaPay / bank confirm.
    }
  })()
}
