/** Shared invitation entry accepts founder and referral codes; lookup distinguishes them. */
export function normalizeUcatInvitationCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9-]{2,41}$/.test(code) ? code : null;
}

export type UcatFounderOfferInput = {
  code: string;
  name: string;
  campaign: string;
  kind: 'access_pass' | 'discount';
  duration_unit: 'week' | 'month' | null;
  duration_count: number | null;
  percent_off: number | null;
  max_redemptions: number | null;
  expires_at: string | null;
};

export function parseUcatFounderOffer(value: unknown): UcatFounderOfferInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const code = normalizeUcatInvitationCode(input.code);
  if (!code) return null;
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 100) return null;
  if (typeof input.campaign !== 'string' || !input.campaign.trim() || input.campaign.trim().length > 100) return null;
  const { kind, duration_unit, duration_count, percent_off, max_redemptions, expires_at } = input;
  if (kind !== 'access_pass' && kind !== 'discount') return null;
  if (kind === 'access_pass' && (
    (duration_unit !== 'week' && duration_unit !== 'month') ||
    typeof duration_count !== 'number' || !Number.isInteger(duration_count) || duration_count < 1 || duration_count > 24
  )) return null;
  if (kind === 'discount' && (typeof percent_off !== 'number' || !Number.isInteger(percent_off) || percent_off < 1 || percent_off > 100)) return null;
  if (max_redemptions != null && (typeof max_redemptions !== 'number' || !Number.isSafeInteger(max_redemptions) || max_redemptions < 1)) return null;
  if (expires_at != null && (typeof expires_at !== 'string' || !Number.isFinite(Date.parse(expires_at)) || Date.parse(expires_at) <= Date.now())) return null;
  return {
    code, name: input.name.trim(), campaign: input.campaign.trim(), kind,
    duration_unit: kind === 'access_pass' ? duration_unit as 'week' | 'month' : null,
    duration_count: kind === 'access_pass' ? duration_count as number : null,
    percent_off: kind === 'discount' ? percent_off as number : null,
    max_redemptions: max_redemptions == null ? null : max_redemptions as number,
    expires_at: expires_at == null ? null : new Date(expires_at as string).toISOString(),
  };
}

export function ucatFounderOfferDescription(offer: {
  kind: string; duration_count: number | null; duration_unit: string | null; percent_off: number | null;
}): string {
  if (offer.kind === 'discount') return `${offer.percent_off}% off while your subscription stays active`;
  return `${offer.duration_count} free ${offer.duration_unit}${offer.duration_count === 1 ? '' : 's'} of UCAT Unlimited`;
}
