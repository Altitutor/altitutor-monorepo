import { getOnlineProductName } from '@altitutor/shared';
import type { OnlineProductRelationshipSummary } from '../api/students';

export function onlineProductSummary(product: OnlineProductRelationshipSummary): string {
  return `${getOnlineProductName(product.product)} · ${product.tier === 'UNLIMITED' ? 'Unlimited' : 'Free'}`;
}
