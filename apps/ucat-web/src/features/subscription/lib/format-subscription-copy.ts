import type { PublicUcatSubscriptionConfig } from '@/features/subscription/types/public-subscription-config'

export function formatMoneyFromMinorUnits(amountCents: number, currencyCode: string): string {
  const code = currencyCode.toUpperCase()
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
    }).format(amountCents / 100)
  } catch {
    return `${code} ${(amountCents / 100).toFixed(2)}`
  }
}

export function billingIntervalLabel(interval: PublicUcatSubscriptionConfig['billingInterval']): string {
  switch (interval) {
    case 'week':
      return 'Weekly'
    case 'fortnight':
      return 'Fortnightly'
    case 'month':
      return 'Monthly'
    default:
      return 'Weekly'
  }
}

export function billingIntervalNoun(interval: PublicUcatSubscriptionConfig['billingInterval']): string {
  switch (interval) {
    case 'week':
      return 'week'
    case 'fortnight':
      return 'fortnight'
    case 'month':
      return 'month'
    default:
      return 'week'
  }
}
