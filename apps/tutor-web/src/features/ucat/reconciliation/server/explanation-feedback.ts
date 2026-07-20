import 'server-only'

import { supabaseAdmin } from '@/shared/lib/supabase/server/admin'
import type { ExplanationFeedbackSummary } from '@/features/ucat/reconciliation/api/reconciliation'

export async function getOpenExplanationFeedback(questionIds?: string[]) {
  if (!supabaseAdmin || (questionIds && questionIds.length === 0)) return []

  let query = supabaseAdmin
    .from('student_ucat_content_ratings')
    .select('question_id,vote,reason_code,reason_text,created_at,updated_at')
    .eq('target_type', 'answer_explanation')
    .is('resolved_at', null)
    .not('question_id', 'is', null)

  if (questionIds) query = query.in('question_id', questionIds)

  const { data, error } = await query.order('updated_at', { ascending: false })
  if (error) throw error

  const summaries = new Map<string, ExplanationFeedbackSummary>()
  for (const row of data ?? []) {
    if (!row.question_id) continue
    const summary = summaries.get(row.question_id) ?? {
      questionId: row.question_id,
      upvotes: 0,
      downvotes: 0,
      reasonCounts: {},
      comments: [],
      latestAt: row.updated_at,
    }
    if (row.vote === 1) summary.upvotes += 1
    if (row.vote === -1) summary.downvotes += 1
    if (row.reason_code) {
      summary.reasonCounts[row.reason_code] = (summary.reasonCounts[row.reason_code] ?? 0) + 1
    }
    if (row.reason_text) {
      summary.comments.push({
        reasonCode: row.reason_code,
        text: row.reason_text,
        createdAt: row.created_at,
      })
    }
    summaries.set(row.question_id, summary)
  }

  return Array.from(summaries.values())
}
