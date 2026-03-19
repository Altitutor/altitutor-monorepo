import {
  defaultPublicSubscriptionConfig,
  type PublicUcatSubscriptionConfig,
} from '@/features/subscription/types/public-subscription-config'

const BILLING: PublicUcatSubscriptionConfig['billingInterval'][] = [
  'week',
  'fortnight',
  'month',
]

function isBillingInterval(
  v: unknown
): v is PublicUcatSubscriptionConfig['billingInterval'] {
  return typeof v === 'string' && (BILLING as readonly string[]).includes(v)
}

export async function fetchPublicSubscriptionConfig(): Promise<PublicUcatSubscriptionConfig> {
  try {
    const res = await fetch('/api/ucat/subscription-config', {
      method: 'GET',
      credentials: 'same-origin',
    })
    if (!res.ok) return defaultPublicSubscriptionConfig
    const data = (await res.json()) as Partial<PublicUcatSubscriptionConfig>
    if (
      typeof data.trialDays !== 'number' ||
      typeof data.minQuestionsPerDay !== 'number' ||
      typeof data.discountPerDayCents !== 'number'
    ) {
      return defaultPublicSubscriptionConfig
    }
    const basePriceCents =
      typeof data.basePriceCents === 'number' ? data.basePriceCents : defaultPublicSubscriptionConfig.basePriceCents
    const billingInterval = isBillingInterval(data.billingInterval)
      ? data.billingInterval
      : defaultPublicSubscriptionConfig.billingInterval
    return {
      trialDays: data.trialDays,
      minQuestionsPerDay: data.minQuestionsPerDay,
      discountPerDayCents: data.discountPerDayCents,
      basePriceCents,
      currency: (typeof data.currency === 'string' ? data.currency : defaultPublicSubscriptionConfig.currency).toLowerCase(),
      billingInterval,
    }
  } catch {
    return defaultPublicSubscriptionConfig
  }
}
