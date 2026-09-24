export async function runSetScopedAction(
  activeSetIds: Set<string>,
  setId: string,
  onChange: (activeSetIds: ReadonlySet<string>) => void,
  action: () => Promise<void>,
): Promise<boolean> {
  if (activeSetIds.has(setId)) return false

  activeSetIds.add(setId)
  onChange(new Set(activeSetIds))
  try {
    await action()
    return true
  } finally {
    activeSetIds.delete(setId)
    onChange(new Set(activeSetIds))
  }
}
