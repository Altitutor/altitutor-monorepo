export function snapshotSetDetail(value: {
  name: string
  description: string
  time: number | null
  isPrivate: boolean
  isStudentGenerated: boolean
  stemIds: string[]
}) {
  return JSON.stringify(value)
}

export function isSnapshotDirty(next: string, baseline: string) {
  return next !== baseline
}
