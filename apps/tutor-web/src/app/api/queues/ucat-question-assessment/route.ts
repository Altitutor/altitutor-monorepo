import { handleCallback } from '@vercel/queue'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'
import {
  runBackgroundUcatQuestionAssessment,
} from '@/features/ucat/questions/server/ai-assessment/run-background-assessment'
import type {
  UcatQuestionAssessmentQueueMessage,
} from '@/features/ucat/questions/server/ai-assessment/dispatcher'

export const maxDuration = 600

const consumeAssessment = handleCallback<UcatQuestionAssessmentQueueMessage>(
  async (message, metadata) => {
    try {
      await runBackgroundUcatQuestionAssessment(message)
    } catch (error) {
      const admin = getServiceRoleClient()
      const errorMessage = error instanceof Error ? error.message : 'Background AI assessment failed'
      const { error: updateError } = await admin
        .from('ucat_ai_question_assessment_runs')
        .update({
          status: metadata.deliveryCount < 3 ? 'queued' : 'failed',
          error_message: errorMessage,
          completed_at: metadata.deliveryCount < 3 ? null : new Date().toISOString(),
          queue_message_id: metadata.deliveryCount < 3 ? undefined : null,
        })
        .eq('id', message.runId)
      if (updateError) throw updateError
      if (metadata.deliveryCount < 3) throw error
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (_error, metadata) => ({
      afterSeconds: Math.min(120, 15 * 2 ** (metadata.deliveryCount - 1)),
    }),
  },
)

export async function POST(request: Request) {
  return consumeAssessment(request)
}
