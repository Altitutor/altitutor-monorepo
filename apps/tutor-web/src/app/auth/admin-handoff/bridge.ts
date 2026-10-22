/** A standalone document keeps auth tokens away from analytics and application scripts. */
export function handoffScript(adminOrigin: string) {
  return `(() => {
    const adminOrigin = ${JSON.stringify(adminOrigin)};
    const source = window.opener;
    const status = document.getElementById('status');
    const fail = () => { status.textContent = 'Unable to sign in. Close this tab and try the notification again.'; };
    if (!source) { fail(); return; }
    let received = false;
    window.addEventListener('message', async function receive(event) {
      if (received || event.source !== source || event.origin !== adminOrigin || event.data?.type !== 'admin-handoff-token' || typeof event.data.tokenHash !== 'string') return;
      received = true;
      window.removeEventListener('message', receive);
      window.opener = null;
      try {
        const response = await fetch('/auth/admin-handoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tokenHash: event.data.tokenHash })
        });
        if (!response.ok) throw new Error('Sign-in failed');
        window.location.replace('/pay-tier');
      } catch { fail(); }
    });
    source.postMessage({ type: 'tutor-handoff-ready' }, adminOrigin);
  })();`;
}
