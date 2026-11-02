import { toast } from 'sonner';

/** Open the tutor portal without putting credentials in URLs or sharing refresh tokens. */
export function openPayTierPortal() {
  const origin = new URL(process.env.NEXT_PUBLIC_TUTOR_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://tutor.altitutor.com' : 'http://localhost:3002')).origin;
  const openedTab = window.open(`${origin}/auth/admin-handoff`, '_blank');
  if (!openedTab) {
    toast.error('Allow pop-ups to open your pay tier in the tutor portal.');
    return;
  }

  const tab = openedTab;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort();
    window.removeEventListener('message', ready);
    tab.close();
    toast.error('Unable to open the tutor portal. Please try again.');
  }, 30_000);

  async function ready(event: MessageEvent) {
    if (event.source !== tab || event.origin !== origin || event.data?.type !== 'tutor-handoff-ready') return;
    window.removeEventListener('message', ready);
    if (tab.closed) {
      window.clearTimeout(timeout);
      return;
    }
    try {
      const response = await fetch('/api/auth/tutor-handoff', { method: 'POST', signal: controller.signal });
      if (!response.ok) throw new Error('Handoff failed');
      const result: unknown = await response.json();
      if (!result || typeof result !== 'object' || !('tokenHash' in result) || typeof result.tokenHash !== 'string') {
        throw new Error('Missing sign-in token');
      }
      if (tab.closed || controller.signal.aborted) return;
      tab.postMessage({ type: 'admin-handoff-token', tokenHash: result.tokenHash }, origin);
    } catch {
      if (controller.signal.aborted) return;
      tab.close();
      toast.error('Unable to open the tutor portal. Please try again.');
    } finally {
      window.clearTimeout(timeout);
    }
  }

  window.addEventListener('message', ready);
}
