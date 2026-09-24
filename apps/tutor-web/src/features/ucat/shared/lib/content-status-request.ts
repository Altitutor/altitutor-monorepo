import type { UcatContentStatus } from '@/features/ucat/shared/types'
import {
  readUcatBulkStatusResponse,
  type UcatBulkStatusResult,
} from '@/features/ucat/shared/lifecycle-errors'

export const UCAT_BULK_STATUS_CHUNK_SIZE = 15

export type UcatContentStatusType = 'stem' | 'set' | 'mock' | 'lesson'

export async function patchUcatContentStatus(options: {
  contentType: UcatContentStatusType
  contentIds: string[]
  status: UcatContentStatus
  previousStatus?: UcatContentStatus
  fallback: string
}): Promise<UcatBulkStatusResult> {
  const movedIds: string[] = []
  const failures: UcatBulkStatusResult['failures'] = []

  for (let offset = 0; offset < options.contentIds.length; offset += UCAT_BULK_STATUS_CHUNK_SIZE) {
    const contentIds = options.contentIds.slice(offset, offset + UCAT_BULK_STATUS_CHUNK_SIZE)
    const response = await fetch('/api/ucat/content-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: options.contentType,
        contentIds,
        status: options.status,
        previousStatus: options.previousStatus,
      }),
    })
    const result = await readUcatBulkStatusResponse(response, options.fallback)
    movedIds.push(...result.movedIds)
    failures.push(...result.failures)
  }

  return { movedIds, failures }
}
