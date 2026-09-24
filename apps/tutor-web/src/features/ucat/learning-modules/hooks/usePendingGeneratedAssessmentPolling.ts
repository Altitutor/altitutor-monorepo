'use client'

import { useEffect, useRef } from 'react'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { DraftBlock } from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import {
  isPendingGeneratedAssessment,
  patchPendingGeneratedAssessmentContent,
} from '@/features/ucat/learning-modules/lib/pending-generated-assessment'

const POLL_INTERVAL_MS = 4000

type UsePendingGeneratedAssessmentPollingArgs = {
  draftBlocks: DraftBlock[]
  updateBlock: (clientId: string, patch: Partial<DraftBlock>) => void
  enabled?: boolean
}

function firstQuestionId(detail: Awaited<ReturnType<typeof ucatQuestionsApi.getDetail>>): string | null {
  const questions = detail?.questions ?? []
  const first = questions[0]
  return first && typeof first.id === 'string' ? first.id : null
}

export function usePendingGeneratedAssessmentPolling({
  draftBlocks,
  updateBlock,
  enabled = true,
}: UsePendingGeneratedAssessmentPollingArgs) {
  const draftBlocksRef = useRef(draftBlocks)
  draftBlocksRef.current = draftBlocks

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      const pendingBlocks = draftBlocksRef.current.filter((block) =>
        isPendingGeneratedAssessment(block.content),
      )
      if (pendingBlocks.length === 0) {
        timer = setTimeout(poll, POLL_INTERVAL_MS)
        return
      }

      await Promise.all(
        pendingBlocks.map(async (block) => {
          if (cancelled || !isPendingGeneratedAssessment(block.content)) return
          const { generationRunId, generationStatus } = block.content

          try {
            if (generationStatus === 'running' || (generationStatus === 'linked' && !block.question_stem_id && !block.question_id)) {
              const run = await ucatQuestionsApi.getGenerationRun(generationRunId)
              if (cancelled || !run) return

              if (run.status === 'failed') {
                updateBlock(block.clientId, {
                  content: patchPendingGeneratedAssessmentContent(block.content, {
                    generationStatus: 'failed',
                    generationError: run.error_message ?? 'AI generation failed.',
                  }),
                })
                return
              }

              if (run.status === 'completed') {
                const stemId = run.generated_stem_ids[0] ?? null
                if (!stemId) {
                  updateBlock(block.clientId, {
                    content: patchPendingGeneratedAssessmentContent(block.content, {
                      generationStatus: 'failed',
                      generationError: 'Generation finished without a stem ID.',
                    }),
                  })
                  return
                }

                if (block.content.generationBlockIntent === 'question') {
                  const detail = await ucatQuestionsApi.getDetail(stemId)
                  const questionId = firstQuestionId(detail)
                  if (!questionId) {
                    updateBlock(block.clientId, {
                      content: patchPendingGeneratedAssessmentContent(block.content, {
                        generationStatus: 'failed',
                        generationError: 'Generated stem has no questions to link yet.',
                      }),
                    })
                    return
                  }
                  updateBlock(block.clientId, {
                    question_id: questionId,
                    question_stem_id: stemId,
                    content: patchPendingGeneratedAssessmentContent(block.content, {
                      generationStatus: 'linked',
                      generationError: undefined,
                    }),
                  })
                  return
                }

                updateBlock(block.clientId, {
                  question_stem_id: stemId,
                  content: patchPendingGeneratedAssessmentContent(block.content, {
                    generationStatus: 'linked',
                    generationError: undefined,
                  }),
                })
                return
              }
            }

            if (generationStatus === 'linked') {
              const stemId = block.question_stem_id
              if (!stemId) return
              const detail = await ucatQuestionsApi.getDetail(stemId)
              if (cancelled || !detail) return
              if (detail.status === 'published') {
                updateBlock(block.clientId, {
                  content: patchPendingGeneratedAssessmentContent(block.content, {
                    pendingGeneratedStem: false,
                  }),
                })
              }
            }
          } catch {
            // Keep polling; transient network errors should not clear the placeholder.
          }
        }),
      )

      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS)
      }
    }

    void poll()

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [enabled, updateBlock])
}
