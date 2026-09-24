const SYSTEM_PERFORMER_NAMES = new Set(['System', 'Unknown', 'Student', 'Staff']);

export function isHumanPerformer(name: string | undefined): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return false;
  return !SYSTEM_PERFORMER_NAMES.has(trimmed);
}

export function getPerformerInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  if (trimmed.includes('@')) {
    const localPart = trimmed.split('@')[0] ?? trimmed;
    const segments = localPart.split(/[._-]+/).filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]![0] ?? ''}${segments[1]![0] ?? ''}`.toUpperCase();
    }
    return localPart.slice(0, 2).toUpperCase();
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

export function getPerformerAvatarColorClass(_name: string): string {
  return 'bg-muted text-muted-foreground';
}
