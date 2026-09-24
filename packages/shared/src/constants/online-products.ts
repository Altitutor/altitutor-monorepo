export const ONLINE_PRODUCT_NAMES = {
  UCAT_WEB: 'Altitutor UCAT',
  STUDENT_WEB: 'Altitutor Student Online',
} as const;

export type OnlineProductCode = keyof typeof ONLINE_PRODUCT_NAMES;

export function getOnlineProductName(product: OnlineProductCode): string {
  return ONLINE_PRODUCT_NAMES[product];
}
