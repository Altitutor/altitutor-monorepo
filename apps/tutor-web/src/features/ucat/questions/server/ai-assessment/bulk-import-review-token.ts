import { createHmac, timingSafeEqual } from 'node:crypto'

type ReviewTokenPayload = {
  draftStemId: string
  promptVersion: number
  fingerprints: unknown
  assessment: unknown
  blindSolution: unknown
  provenance?: unknown
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  return Object.fromEntries(
    Object.keys(record).sort().map((key) => [key, stable(record[key])])
  )
}

function signingSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Bulk-import AI review signing is not configured.')
  return secret
}

function signature(payload: ReviewTokenPayload): string {
  return createHmac('sha256', signingSecret())
    .update(JSON.stringify(stable(payload)))
    .digest('hex')
}

export function issueBulkImportReviewToken(payload: ReviewTokenPayload): string {
  return `v1.${signature(payload)}`
}

export function verifyBulkImportReviewToken(
  payload: ReviewTokenPayload,
  token: string,
): boolean {
  const expected = issueBulkImportReviewToken(payload)
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(token)
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}
