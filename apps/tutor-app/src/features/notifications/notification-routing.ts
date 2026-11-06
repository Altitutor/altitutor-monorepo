const notificationIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function notificationFromPush(data?: Record<string, unknown>): string | null {
  const { destination, notificationId } = data ?? {};
  return destination === 'inbox' && typeof notificationId === 'string' && notificationIdPattern.test(notificationId)
    ? notificationId
    : null;
}

export function sessionFromInboxAction(action: string | null) {
  if (!action?.startsWith('/classes?')) return null;
  const id = new URLSearchParams(action.slice('/classes?'.length)).get('session');
  return id && notificationIdPattern.test(id) ? id : null;
}
