/** Apple Messages limits (iOS 16+ / macOS 13+): edit 15 minutes, unsend 2 minutes. */
export const IMESSAGE_EDIT_WINDOW_MS = 15 * 60 * 1000;
export const IMESSAGE_UNSEND_WINDOW_MS = 2 * 60 * 1000;

export function messageSentAtMs(
  sentAt?: string | null,
  createdAt?: string | null,
): number | null {
  const raw = sentAt ?? createdAt;
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export function imessageWindowRemainingMs(
  sentAtMs: number | null,
  windowMs: number,
  now = Date.now(),
): number {
  if (sentAtMs == null) return 0;
  return Math.max(0, sentAtMs + windowMs - now);
}

export function canEditImessage(
  sentAtMs: number | null,
  now = Date.now(),
): boolean {
  return imessageWindowRemainingMs(sentAtMs, IMESSAGE_EDIT_WINDOW_MS, now) > 0;
}

export function canUnsendImessage(
  sentAtMs: number | null,
  now = Date.now(),
): boolean {
  return imessageWindowRemainingMs(sentAtMs, IMESSAGE_UNSEND_WINDOW_MS, now) > 0;
}

export function formatImessageWindowRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'expired';
  const totalSec = Math.ceil(remainingMs / 1000);
  if (totalSec < 60) return `${totalSec}s left`;
  const minutes = Math.ceil(totalSec / 60);
  return `${minutes}m left`;
}
