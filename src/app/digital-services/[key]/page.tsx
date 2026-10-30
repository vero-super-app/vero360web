import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ChatGptPlanPickerView from '@/app/components/open-listing/ChatGptPlanPickerView'
import DigitalServiceView from '@/app/components/open-listing/DigitalServiceView'
import NetflixPlanPickerView from '@/app/components/open-listing/NetflixPlanPickerView'
import {
  DEFAULT_DIGITAL_SERVICES_CONFIG,
  getDigitalServicesConfig,
} from '@/lib/digital-services-config'
import {
  digitalBrandImage,
  formatDigitalPriceLabel,
} from '@/lib/digital-brand-images'
import { locksCustomUsdAmount } from '@/lib/digital-services-prepaidforge'
import { detectDigitalPayoutKycKind } from '@/lib/digital-payout-kyc'
import {
  buildPublicChatGptPlans,
  isChatGptHubKey,
  isChatGptPlanKey,
} from '@/lib/chatgpt-plans'
import {
  buildPublicNetflixPlans,
  isNetflixHubKey,
  isNetflixPlanKey,
} from '@/lib/netflix-plans'

type Props = { params: Promise<{ key: string }> }

export const dynamic = 'force-dynamic'

function categoryLabel(category: string): string {
  const c = category.trim().toLowerCase()
  if (c === 'streaming' || c === 'subscription') return 'Subscription'
  if (c === 'gaming') return 'Gaming'
  if (c === 'gift_cards') return 'Gift card'
  if (c === 'crypto') return 'Crypto / FX'
  return 'Digital'
}

async function loadConfigSafe() {
  try {
    return await getDigitalServicesConfig()
  } catch (err) {
    console.error('digital-services detail config:', err)
    return { ...DEFAULT_DIGITAL_SERVICES_CONFIG }
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { key } = await params
    if (isNetflixHubKey(key)) {
      return {
        title: 'Netflix · Choose your plan · Vero360',
        description:
          'Pick Mobile, Basic, Standard, or Premium Netflix on Vero360.',
      }
    }
    if (isChatGptHubKey(key)) {
      return {
        title: 'ChatGPT · Choose your plan · Vero360',
        description:
          'Basic ChatGPT Plus for students, or a private ChatGPT Plus account for one person.',
      }
    }
    const config = await loadConfigSafe()
    const product = config.products.find(p => p.key === key && p.active !== false)
    if (!product) return { title: 'Digital Service · Vero360' }
    return {
      title: `${product.name} · Buy · Vero360`,
      description: product.subtitle || `Buy ${product.name} on Vero360`,
    }
  } catch {
    return { title: 'Digital Service · Vero360' }
  }
}

export default async function DigitalServiceDetailPage({ params }: Props) {
  const { key } = await params
  const config = await loadConfigSafe()

  if (isNetflixHubKey(key)) {
    const hub = config.products.find(p => p.key === 'netflix')
    if (hub && hub.active === false) notFound()
    const plans = buildPublicNetflixPlans(config.products)
    if (!plans.length) notFound()
    return (
      <NetflixPlanPickerView
        plans={plans}
        brandImage={digitalBrandImage('netflix', hub?.imageUrl)}
      />
    )
  }

  if (isChatGptHubKey(key)) {
    const hub = config.products.find(p => p.key === 'chatgpt')
    if (hub && hub.active === false) notFound()
    const plans = buildPublicChatGptPlans(config.products)
    if (!plans.length) notFound()
    return (
      <ChatGptPlanPickerView
        plans={plans}
        brandImage={digitalBrandImage('chatgpt', hub?.imageUrl)}
      />
    )
  }

  const product = config.products.find(p => p.key === key && p.active !== false)
  if (!product) notFound()

  const fixed =
    typeof product.fixedMwkPrice === 'number' && product.fixedMwkPrice > 0
      ? Math.round(product.fixedMwkPrice)
      : null
  const isFixedPrice = fixed != null
  const labels = formatDigitalPriceLabel({
    fixedMwkPrice: fixed,
    usdAmounts: product.usdAmounts,
    usdToMwkRate: config.usdToMwkRate,
    mwkPerUnit: product.mwkPerUnit,
    unitLabel: product.unitLabel,
    isSubscription: isFixedPrice,
  })

  return (
    <DigitalServiceView
      product={{
        key: product.key,
        name: product.name,
        subtitle: product.subtitle || null,
        categoryLabel: categoryLabel(product.category),
        brandTag: product.brandTag || null,
        image: digitalBrandImage(product.key, product.imageUrl),
        priceLabel: labels.priceLabel,
        amountsLabel: labels.amountsLabel,
        rateLabel: labels.rateLabel,
        fixedMwkPrice: fixed,
        usdAmounts: Array.isArray(product.usdAmounts) ? product.usdAmounts : [],
        usdToMwkRate:
          product.mwkPerUnit && product.mwkPerUnit > 0
            ? product.mwkPerUnit
            : config.usdToMwkRate || 4700,
        unitLabel: product.unitLabel || null,
        isFixedPrice,
        category: product.category,
        payoutKind: detectDigitalPayoutKycKind(product),
        prepaidForgeRegion: product.prepaidForge?.region || null,
        prepaidForgeLocksCustomAmount: locksCustomUsdAmount(product.prepaidForge),
        backHref: isNetflixPlanKey(product.key)
          ? '/digital-services/netflix'
          : isChatGptPlanKey(product.key)
            ? '/digital-services/chatgpt'
            : '/browse/digital-services',
        backLabel:
          isNetflixPlanKey(product.key) || isChatGptPlanKey(product.key)
            ? 'Choose your plan'
            : 'All digital',
      }}
    />
  )
}
