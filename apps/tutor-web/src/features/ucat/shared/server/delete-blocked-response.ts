import { NextResponse } from 'next/server'
import type { UcatTutorSupabaseClient } from '@/features/ucat/shared/server/guard'
import {
  failedUcatDeleteContentId,
  isUcatDeleteBlockedError,
  isUcatVisibilityBlockedError,
  parseUcatLifecycleBlockers,
  publishedContentInvalidBlockers,
  ucatDeleteBlockedPayload,
  ucatPublishedContentInvalidPayload,
  ucatVisibilityBlockedPayload,
  type UcatDeleteContentType,
  type UcatVisibilityContentType,
} from '@/features/ucat/shared/lifecycle-errors'

export function ucatMemberIds(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string')
    : undefined
}

export function jsonUcatPublishedContentErrorResponse(errorMessage: string): NextResponse | null {
  const blockers = publishedContentInvalidBlockers(errorMessage)
  if (blockers.length === 0) return null
  return NextResponse.json(ucatPublishedContentInvalidPayload(blockers), { status: 409 })
}

export async function jsonUcatDeleteErrorResponse(
  client: UcatTutorSupabaseClient,
  options: {
    contentType: UcatDeleteContentType
    contentId: string
    errorMessage: string
  },
): Promise<NextResponse> {
  const published = jsonUcatPublishedContentErrorResponse(options.errorMessage)
  if (published) return published

  if (!isUcatDeleteBlockedError(options.errorMessage)) {
    return NextResponse.json({ error: options.errorMessage }, { status: 400 })
  }

  const contentId = failedUcatDeleteContentId(options.errorMessage, options.contentId)
  const { data } = await client.rpc('tutor_ucat_content_delete_blockers', {
    p_content_type: options.contentType,
    p_content_id: contentId,
  })
  return NextResponse.json(
    ucatDeleteBlockedPayload(parseUcatLifecycleBlockers(data), options.contentType),
    { status: 409 },
  )
}

export async function jsonUcatVisibilityErrorResponse(
  client: UcatTutorSupabaseClient,
  options: {
    contentType: UcatVisibilityContentType
    contentId: string
    accessScope: 'public' | 'private'
    memberIds?: string[]
    errorMessage: string
  },
): Promise<NextResponse> {
  const published = jsonUcatPublishedContentErrorResponse(options.errorMessage)
  if (published) return published

  if (!isUcatVisibilityBlockedError(options.errorMessage)) {
    return NextResponse.json({ error: options.errorMessage }, { status: 400 })
  }

  const contentId = failedUcatDeleteContentId(options.errorMessage, options.contentId)
  const { data } = await client.rpc('tutor_ucat_content_visibility_blockers', {
    p_content_type: options.contentType,
    p_content_id: contentId,
    p_access_scope: options.accessScope,
    p_member_ids: options.memberIds ?? null,
  })
  return NextResponse.json(
    ucatVisibilityBlockedPayload(parseUcatLifecycleBlockers(data), options.errorMessage),
    { status: 409 },
  )
}
