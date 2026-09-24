import { handleCallback } from '@vercel/queue'
import {
  runBackgroundUcatGeneration,
  type UcatQuestionGenerationQueueMessage,
} from '@/features/ucat/questions/server/run-background-generation'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'

export const maxDuration = 600

const consumeGeneration = handleCallback<UcatQuestionGenerationQueueMessage>(
  async (message, metadata) => {
    try {
      await runBackgroundUcatGeneration(message)
    } catch (error) {
      if (metadata.deliveryCount < 3) throw error

      const errorMessage = error instanceof Error ? error.message : 'Background generation failed'
      const admin = getServiceRoleClient()
      const { error: updateError } = await admin
        .from('ucat_ai_generation_runs')
        .update({
          status: 'failed',
          progress_message: errorMessage,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_by: message.staffId,
        })
        .eq('id', message.runId)
      if (updateError) throw updateError
    }
  },
  {
    visibilityTimeoutSeconds: 600,
    retry: (_error, metadata) => {
      return { afterSeconds: Math.min(120, 15 * 2 ** (metadata.deliveryCount - 1)) }
    },
  },
)

export async function POST(request: Request) {
  return consumeGeneration(request)
}
