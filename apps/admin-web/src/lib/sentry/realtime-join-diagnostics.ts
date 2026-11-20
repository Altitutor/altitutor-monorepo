import * as Sentry from '@sentry/nextjs';

const limits = new Set(['too_many_channels', 'too_many_joins']);
const tables = ['projects', 'project_members', 'tasks', 'notes', 'issues', 'document_edit_locks'];
const collections = ['dashboard', 'students', 'parents', 'staff', 'classes', 'sessions', 'subjects', 'topics', 'projects', 'tasks', 'issues', 'documents', 'notes', 'messages', 'email', 'today'];

function topicCategory(topic: string) {
  const name = topic.replace(/^realtime:/, '');
  const table = tables.find((table) => name.startsWith(`admin-realtime-${table}-`));
  if (table) return table;
  if (name === 'admin-messages' || name.startsWith('messages-conversation-') || name.startsWith('messages-contact-')) return 'messages';
  if (name.startsWith('conversations-list-')) return 'conversations';
  if (name === 'notifications-changes') return 'notifications';
  return 'other';
}

function routeTemplate(pathname: string) {
  const parts = pathname.split(/[?#]/, 1)[0].split('/').filter(Boolean);
  if (!collections.includes(parts[0])) return '/other';
  return `/${parts[0]}${parts.length > 1 ? '/:id' : ''}`;
}

/**
 * DEV-399 evidence for the separate unresolved rate-limit incident.
 * Remove after incident resolution or 30 production days without a capture.
 * The caller must explicitly enable this observer; it never logs SDK payloads.
 */
export function createRealtimeJoinDiagnostics(options: {
  enabled: boolean;
  capture?: typeof Sentry.captureEvent;
  pathname: () => string;
  channels: () => ReadonlyArray<{ topic: string }>;
}) {
  if (!options.enabled) return undefined;
  const seen = new Set<string>();
  return (kind: string, message: string, data?: unknown) => {
    try {
      if (kind !== 'receive' || !data || typeof data !== 'object') return;
      const payload = data as { status?: unknown; response?: { reason?: unknown } };
      const code = payload.response?.reason;
      if (payload.status !== 'error' || typeof code !== 'string' || !limits.has(code) || seen.has(code)) return;
      const match = /^error (\S+) phx_reply(?: \([^)]*\))?$/.exec(message);
      if (!match) return;
      seen.add(code);
      const counts: Record<string, number> = {};
      options.channels().forEach(({ topic }) => {
        const category = topicCategory(topic);
        counts[category] = (counts[category] ?? 0) + 1;
      });
      const context = {
        schema: 1, code, route: routeTemplate(options.pathname()),
        topic: topicCategory(match[1]), channels: counts,
      };
      const scope = new Sentry.Scope();
      scope.setClient(Sentry.getClient());
      Sentry.withScope(scope, (isolated) => {
        isolated.addEventProcessor((event) => ({
          event_id: event.event_id, timestamp: event.timestamp,
          release: event.release, environment: event.environment,
          level: 'info', message: 'Admin Realtime join limit',
          contexts: { realtime_join: context },
        }));
        (options.capture ?? Sentry.captureEvent)({ message: 'Admin Realtime join limit' });
      });
    } catch {
      // Diagnostics must never affect Phoenix delivery or retry behavior.
    }
  };
}
