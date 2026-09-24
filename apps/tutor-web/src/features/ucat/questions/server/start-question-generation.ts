import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { send } from '@vercel/queue'
import {
  generationActorFromUser,
  prepareGenerationContext,
  type GenerateBody,
} from '@/features/ucat/questions/server/generate-question-stems'
import {
  runBackgroundUcatGeneration,
  type UcatQuestionGenerationQueueMessage,
} from '@/features/ucat/questions/server/run-background-generation'
import { upsertUcatGenerationNotification } from '@/features/ucat/questions/server/ucat-generation-notification'
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role'

const GENERATION_TOPIC = 'ucat-question-generation'
const useLocalRunner = process.env.NODE_ENV === 'development'

function startLocalGeneration(message: UcatQuestionGenerationQueueMessage) {
  setTimeout(() => {
    void runBackgroundUcatGeneration(message).catch(async (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Background generation failed'
      const admin = getServiceRoleClient()
      await admin
        .from('ucat_ai_generation_runs')
        .update({
          status: 'failed',
          progress_step: 'drafts',
          progress_message: errorMessage,
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
          updated_by: message.staffId,
        })
        .eq('id', message.runId)
      await upsertUcatGenerationNotification(admin, {
        staffId: message.staffId,
        runId: message.runId,
        status: 'failed',
        requestedStemCount: message.body.stemCount,
        message: errorMessage,
      }).catch((notificationError) => {
        console.error('Failed to upsert generation failure notification:', notificationError)
      })
    })
  }, 0)
}

export async function startUcatQuestionGeneration(
  client: SupabaseClient<Database>,
  body: GenerateBody,
): Promise<{ runId: string }> {
  let runId: string | null = null
  try {
    const [prepared, userResult, staffResult] = await Promise.all([
      prepareGenerationContext(client, body),
      client.auth.getUser(),
      client.rpc('current_tutor_id'),
    ])
    const staffId = typeof staffResult.data === 'string' ? staffResult.data : null
    if (!staffId) throw new Error('Tutor profile not found')

    const admin = getServiceRoleClient()
    const { data: createdRun, error: createError } = await admin
      .from('ucat_ai_generation_runs')
      .insert({
        section_id: body.sectionId,
        question_stem_category_id: body.categoryId ?? null,
        model_profile_id: body.modelProfileId ?? null,
        status: 'running',
        requested_stem_count: body.stemCount,
        created_by: staffId,
        updated_by: staffId,
      })
      .select('id')
      .single()
    if (createError || !createdRun) throw createError ?? new Error('Could not create generation run')
    runId = createdRun.id

    const message: UcatQuestionGenerationQueueMessage = {
      runId,
      staffId,
      body,
      actor: generationActorFromUser(userResult.data.user),
      prepared,
    }
    const queueMessageId = useLocalRunner
      ? `local:${runId}`
      : (await send(GENERATION_TOPIC, message, {
          idempotencyKey: `ucat-generation:${runId}`,
          retentionSeconds: 86_400,
        })).messageId

    const { error: updateError } = await admin
      .from('ucat_ai_generation_runs')
      .update({
        queue_message_id: queueMessageId,
        progress_step: 'setup',
        progress_message: 'Generation queued',
      })
      .eq('id', runId)
    if (updateError) throw updateError

    await upsertUcatGenerationNotification(admin, {
      staffId,
      runId,
      status: 'running',
      requestedStemCount: body.stemCount,
      processedStemCount: 0,
      progressMessage: 'Generation queued',
    })

    if (useLocalRunner) startLocalGeneration(message)
    return { runId }
  } catch (error) {
    if (runId) {
      const failMessage = error instanceof Error ? error.message : 'Unable to start generation'
      const admin = getServiceRoleClient()
      await admin
        .from('ucat_ai_generation_runs')
        .update({
          status: 'failed',
          progress_step: 'setup',
          progress_message: 'Unable to queue generation',
          error_message: failMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)

      const staffIdResult = await client.rpc('current_tutor_id')
      const staffId = typeof staffIdResult.data === 'string' ? staffIdResult.data : null
      if (staffId) {
        await upsertUcatGenerationNotification(admin, {
          staffId,
          runId,
          status: 'failed',
          requestedStemCount: body.stemCount,
          message: failMessage,
        }).catch((notificationError) => {
          console.error('Failed to upsert generation start failure notification:', notificationError)
        })
      }
    }
    throw error
  }
}

