'use client'

import { useMemo } from 'react'
import { BulkImportRichTextPreview } from '@/features/ucat/questions/components/bulk-import/BulkImportRichTextPreview'
import type { UcatQuestionCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import type { UcatSkillTrainerSetRow } from '@/features/ucat/skill-trainer-sets/types'
import {
  BLOCK_TYPE_LABELS,
  type DraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import type { Json } from '@altitutor/shared'

type StemOption = { id: string; text: string }

type UcatLearningModuleLessonPreviewProps = {
  title: string
  description: string
  displayMode: 'scroll' | 'stepped'
  blocks: DraftBlock[]
  stemOptions?: StemOption[]
  questionOptions?: UcatQuestionCatalogItem[]
  skillTrainerSets?: UcatSkillTrainerSetRow[]
}

function BlockPreviewBody({
  block,
  stemOptions,
  questionOptions,
  skillTrainerSets,
}: {
  block: DraftBlock
  stemOptions: StemOption[]
  questionOptions: UcatQuestionCatalogItem[]
  skillTrainerSets: UcatSkillTrainerSetRow[]
}) {
  const stemLabel =
    stemOptions.find((s) => s.id === block.question_stem_id)?.text ?? block.question_stem_id
  const questionLabel =
    questionOptions.find((q) => q.id === block.question_id)?.label ?? block.question_id
  const skillTrainerSetLabel = useMemo(() => {
    if (!block.skill_trainer_set_id) return null
    const set = skillTrainerSets.find((s) => s.id === block.skill_trainer_set_id)
    return set ? `${set.trainer_name}: ${set.name}` : block.skill_trainer_set_id
  }, [block.skill_trainer_set_id, skillTrainerSets])

  if (block.block_type === 'text') {
    return (
      <BulkImportRichTextPreview
        json={(block.content.body as Json) ?? null}
        emptyFallback={<p className="text-sm text-muted-foreground">Empty text block</p>}
      />
    )
  }

  if (block.block_type === 'video') {
    return block.content.url ? (
      <div className="aspect-video overflow-hidden rounded-lg border bg-muted/30">
        <p className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
          Video: {String(block.content.url)}
        </p>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No video URL configured</p>
    )
  }

  if (block.block_type === 'file') {
    return (
      <div className="space-y-1 text-sm">
        <p>
          <span className="text-muted-foreground">File: </span>
          {String(block.content.label ?? block.file_id ?? 'Not set')}
        </p>
        {block.content.url ? (
          <p>
            <span className="text-muted-foreground">Link: </span>
            {String(block.content.label ?? 'Open file')} → {String(block.content.url)}
          </p>
        ) : null}
      </div>
    )
  }

  if (block.block_type === 'question_stem') {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Students work through the linked question stem inline.</p>
        <p className="text-foreground">{stemLabel ?? 'No stem selected'}</p>
      </div>
    )
  }

  if (block.block_type === 'question') {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Students answer the linked question inline.</p>
        <p className="text-foreground">{questionLabel ?? 'No question selected'}</p>
      </div>
    )
  }

  if (block.block_type === 'skill_trainer_set') {
    return (
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Students complete the linked skill trainer set.</p>
        <p className="text-foreground">
          {skillTrainerSetLabel ?? block.skill_trainer_set_id ?? 'Not set'}
        </p>
      </div>
    )
  }

  return null
}

export function UcatLearningModuleLessonPreview({
  title,
  description,
  displayMode,
  blocks,
  stemOptions = [],
  questionOptions = [],
  skillTrainerSets = [],
}: UcatLearningModuleLessonPreviewProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <h2 className="text-2xl font-semibold">{title.trim() || 'Untitled lesson'}</h2>
          {description.trim() ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground capitalize">
            Display: {displayMode} · {blocks.length} block{blocks.length === 1 ? '' : 's'}
          </p>
        </header>

        {blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">This lesson has no blocks yet.</p>
        ) : (
          <div className="space-y-4">
            {blocks.map((block, index) => (
              <article key={block.clientId} className={tutorCardCn('overflow-hidden')}>
                <div className="border-b border-black/[0.06] px-4 py-2.5 dark:border-white/10">
                  <p className="text-sm font-semibold capitalize">
                    {index + 1}. {BLOCK_TYPE_LABELS[block.block_type]}
                  </p>
                  {block.require_completion_before_next ? (
                    <p className="text-xs text-muted-foreground">Required before next block</p>
                  ) : null}
                </div>
                <div className="p-4">
                  <BlockPreviewBody
                    block={block}
                    stemOptions={stemOptions}
                    questionOptions={questionOptions}
                    skillTrainerSets={skillTrainerSets}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
