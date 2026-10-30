export type PrepaidForgeCodeType = 'TEXT' | 'SCAN'

export type PrepaidForgeProductConfig = {
  enabled: boolean
  region: string
  skuByUsd: Record<string, string>
  preferredCodeType: PrepaidForgeCodeType
}

export type PrepaidForgeAutoStamp = {
  fulfillmentMode: 'auto'
  fulfillmentProvider: 'prepaidforge'
  prepaidForgeSku: string
  prepaidForgeRegion: string
  prepaidForgeCodeType: PrepaidForgeCodeType
}

function usdSkuKeys(usd: number): string[] {
  if (!Number.isFinite(usd) || usd <= 0) return []
  const rounded = Math.round(usd * 100) / 100
  return Array.from(
    new Set([
      String(rounded),
      rounded.toFixed(0),
      rounded.toFixed(2),
      String(Math.round(rounded)),
    ]),
  )
}

export function skuForUsd(
  skuByUsd: Record<string, string> | undefined,
  usd: number | null | undefined,
): string | null {
  if (!skuByUsd || usd == null) return null
  for (const key of usdSkuKeys(usd)) {
    const sku = String(skuByUsd[key] || '').trim()
    if (sku) return sku
  }
  return null
}

function parseSkuByUsd(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const sku = String(value ?? '').trim()
    const k = String(key).trim()
    if (k && sku) out[k] = sku
  }
  return out
}

export function parsePrepaidForgeConfig(
  raw: unknown,
): PrepaidForgeProductConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Record<string, unknown>
  const skuByUsd = parseSkuByUsd(d.skuByUsd)
  const codeRaw = String(d.preferredCodeType || d.codeType || 'TEXT')
    .trim()
    .toUpperCase()
  return {
    enabled: d.enabled === true,
    region: String(d.region || '').trim(),
    skuByUsd,
    preferredCodeType: codeRaw === 'SCAN' ? 'SCAN' : 'TEXT',
  }
}

export function prepaidForgeForFirestore(
  raw: PrepaidForgeProductConfig | null | undefined,
): Record<string, unknown> | null {
  if (!raw) return null
  const skuByUsd = parseSkuByUsd(raw.skuByUsd)
  if (!raw.enabled && !raw.region && !Object.keys(skuByUsd).length) return null
  return {
    enabled: raw.enabled === true,
    region: (raw.region || '').trim(),
    skuByUsd,
    preferredCodeType: raw.preferredCodeType === 'SCAN' ? 'SCAN' : 'TEXT',
  }
}

export function resolvePrepaidForgeAutoStamp(opts: {
  prepaidForge?: PrepaidForgeProductConfig | null
  selectedUsd: number | null
}): PrepaidForgeAutoStamp | null {
  const cfg = opts.prepaidForge
  if (!cfg?.enabled) return null
  const sku = skuForUsd(cfg.skuByUsd, opts.selectedUsd)
  if (!sku) return null
  return {
    fulfillmentMode: 'auto',
    fulfillmentProvider: 'prepaidforge',
    prepaidForgeSku: sku,
    prepaidForgeRegion: cfg.region,
    prepaidForgeCodeType: cfg.preferredCodeType,
  }
}

export function locksCustomUsdAmount(
  prepaidForge?: PrepaidForgeProductConfig | null,
): boolean {
  return Boolean(prepaidForge?.enabled && Object.keys(prepaidForge.skuByUsd || {}).length)
}

export function isAutoFulfillOrder(data: {
  fulfillmentMode?: unknown
}): boolean {
  return String(data.fulfillmentMode || '').trim().toLowerCase() === 'auto'
}
