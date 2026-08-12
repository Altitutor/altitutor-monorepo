/**
 * One-shot backfill of denormalized catalog AI review statuses.
 *
 * Usage (from apps/tutor-web, with service role env):
 *   pnpm exec tsx scripts/backfill-ucat-catalog-ai-review-status.ts
 *
 * Optional: LIMIT=200 BATCH=50 pnpm exec tsx scripts/backfill-ucat-catalog-ai-review-status.ts
 */
import process from 'node:process'
import { getServiceRoleClient } from '../src/shared/lib/supabase/service-role'
import {
  createPersistStemAiReviewStatusPorts,
  persistStemAiReviewStatus,
} from '../src/features/ucat/questions/server/ai-assessment/persist-catalog-status'

function requiredEnvironment(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function main() {
  requiredEnvironment('NEXT_PUBLIC_SUPABASE_URL')
  requiredEnvironment('SUPABASE_SERVICE_ROLE_KEY')

  const admin = getServiceRoleClient()
  const ports = createPersistStemAiReviewStatusPorts(admin)
  const limit = Number(process.env.LIMIT ?? '0')
  const batchSize = Math.max(1, Number(process.env.BATCH ?? '100'))

  let offset = 0
  let processed = 0
  let updated = 0

  for (;;) {
    let query = admin
      .from('ucat_question_catalog_projection')
      .select('stem_id')
      .order('stem_id')
      .range(offset, offset + batchSize - 1)
    if (limit > 0) {
      const remaining = limit - processed
      if (remaining <= 0) break
      query = admin
        .from('ucat_question_catalog_projection')
        .select('stem_id')
        .order('stem_id')
        .range(offset, offset + Math.min(batchSize, remaining) - 1)
    }

    const { data, error } = await query
    if (error) throw error
    const rows = data ?? []
    if (rows.length === 0) break

    for (const row of rows) {
      const status = await persistStemAiReviewStatus(row.stem_id, ports)
      processed += 1
      if (status) updated += 1
    }

    console.log(`Processed ${processed} stems (${updated} written)`)
    offset += rows.length
    if (rows.length < batchSize) break
    if (limit > 0 && processed >= limit) break
  }

  console.log(`Done. processed=${processed} written=${updated}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
