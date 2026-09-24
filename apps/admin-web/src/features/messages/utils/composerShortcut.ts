export function isMessageComposerSendShortcut(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey;
}
