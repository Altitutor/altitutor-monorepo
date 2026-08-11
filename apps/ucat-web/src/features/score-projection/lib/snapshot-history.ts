export function onlySnapshotsForModel<T extends { model_version: string }>(
  snapshots: T[],
  modelVersion: string,
): T[] {
  return snapshots.filter(
    (snapshot) => snapshot.model_version === modelVersion,
  );
}
