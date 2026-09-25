export const ACTIVITY_SOURCE_ID = 'events';
export const EMAIL_SOURCE_ID = 'email';

/** Thread order for activity cards mixed with messages. */
export type CommunicationTimeSort = 'logged' | 'effective';

export function communicationActivityAt(
  event: { recorded_at: string; effective_at: string },
  sort: CommunicationTimeSort,
): string {
  if (sort === 'effective') return event.effective_at || event.recorded_at;
  return event.recorded_at;
}

export type CommunicationEntityType = 'student' | 'staff' | 'parent';
export type CommunicationContactKind = 'student' | 'staff' | 'parent';

export interface CommunicationContactRef {
  id: string;
  kind: CommunicationContactKind;
  label: string;
  isCurrent: boolean;
}

export interface CommunicationConversationRef {
  id: string;
  contactId: string | null;
  isGroup: boolean;
}

export function contactSourceId(contactId: string): string {
  return `contact:${contactId}`;
}

export function groupConversationSourceId(conversationId: string): string {
  return `group:${conversationId}`;
}

export function isThreadMessageSource(sourceId: string): boolean {
  return sourceId.startsWith('contact:') || sourceId.startsWith('group:');
}

/** Keep activity and email toggles, and show only the chosen number or group. */
export function sourcesAfterRecipientChange(current: string[], recipientSourceId: string): string[] {
  const kept = current.filter((sourceId) => !isThreadMessageSource(sourceId));
  return kept.includes(recipientSourceId) ? kept : [...kept, recipientSourceId];
}

export function defaultCommunicationSources(input: {
  entityType: CommunicationEntityType;
  contacts: CommunicationContactRef[];
}): string[] {
  const sources = [ACTIVITY_SOURCE_ID];
  const recipientId = defaultRecipientId(input);
  if (recipientId) sources.push(contactSourceId(recipientId));
  return sources;
}

/** Own current number. Linked parents stay out of the default selection. */
export function defaultRecipientId(input: {
  entityType: CommunicationEntityType;
  contacts: CommunicationContactRef[];
}): string {
  const own = input.contacts.filter((contact) => contact.kind === input.entityType);
  return own.find((contact) => contact.isCurrent)?.id ?? own[0]?.id ?? '';
}

export function messageSourceId(input: {
  conversation: CommunicationConversationRef;
  contact: CommunicationContactRef | null;
}): string {
  if (input.conversation.isGroup) return groupConversationSourceId(input.conversation.id);
  const contactId = input.contact?.id ?? input.conversation.contactId;
  return contactId ? contactSourceId(contactId) : 'unknown';
}

export function communicationFilterOptions(input: {
  contacts: Array<CommunicationContactRef & { detail?: string }>;
  groups: Array<{ id: string; label: string }>;
  includeEmail?: boolean;
}): Array<{ id: string; label: string }> {
  const options = [{ id: ACTIVITY_SOURCE_ID, label: 'Activity' }];
  for (const contact of input.contacts) {
    options.push({
      id: contactSourceId(contact.id),
      label: contact.detail ? `${contact.label} · ${contact.detail}` : `${contact.label} texts`,
    });
  }
  for (const group of input.groups) {
    options.push({ id: groupConversationSourceId(group.id), label: group.label });
  }
  if (input.includeEmail) options.push({ id: EMAIL_SOURCE_ID, label: 'Emails' });
  return options;
}

const LEGACY_MESSAGE_TAB = 'messages';

export function resolveCombinedActivityTab(tab: string): string {
  return tab === LEGACY_MESSAGE_TAB ? 'activity' : tab;
}
