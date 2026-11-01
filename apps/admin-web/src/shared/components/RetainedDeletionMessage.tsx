export function RetainedDeletionMessage({ kind = 'record', name }: { kind?: string; name?: string | null }) {
  return <>This hides <strong>{name || kind}</strong> from normal views and retains its history. Resolve active work first. Restore it from Settings → Deleted entities; restoration does not restart services or Staff access.</>;
}
