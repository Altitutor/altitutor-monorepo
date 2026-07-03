'use client'

import { useCallback, useRef, useState } from 'react'
import { ArrowLeft, Check, RotateCcw } from 'lucide-react'
import { Button } from '@altitutor/ui'
import { UcatRichContentBlock } from '@/features/ucat/question-engine-preview/UcatRichContentBlock'
import { UcatQuestionEnginePreview } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import type { UcatEnginePreviewQuestion } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import {
  useUcatQuestionDetail,
  type UcatQuestionCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  BLOCK_TYPE_LABELS,
  type DraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { cn } from '@/shared/utils'

type StemOption = { id: string; text: string }

type UcatLearningModuleLessonPreviewProps = {
  title: string
  description: string
  blocks: DraftBlock[]
  stemOptions?: StemOption[]
  questionOptions?: UcatQuestionCatalogItem[]
  skillTrainers?: SkillTrainerOption[]
}

type SkillTrainerOption = {
  id: string
  key: string | null
  name: string | null
}

const LEARNING_TEXT_CONTENT_CLASSNAME = cn(
  'text-foreground',
  '[&_.ProseMirror]:leading-relaxed',
  '[&_.ProseMirror_h1]:mb-4 [&_.ProseMirror_h1]:mt-6 [&_.ProseMirror_h1]:text-3xl [&_.ProseMirror_h1]:font-bold [&_.ProseMirror_h1]:leading-tight',
  '[&_.ProseMirror_h2]:mb-3 [&_.ProseMirror_h2]:mt-5 [&_.ProseMirror_h2]:text-2xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:leading-tight',
  '[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:mt-4 [&_.ProseMirror_h3]:text-xl [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:leading-snug',
  '[&_.ProseMirror_blockquote]:my-4 [&_.ProseMirror_blockquote]:border-l-4 [&_.ProseMirror_blockquote]:border-primary/30 [&_.ProseMirror_blockquote]:pl-4 [&_.ProseMirror_blockquote]:italic [&_.ProseMirror_blockquote]:text-muted-foreground',
  '[&_.ProseMirror_pre]:my-4 [&_.ProseMirror_pre]:overflow-x-auto [&_.ProseMirror_pre]:rounded-md [&_.ProseMirror_pre]:bg-primary/10 [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-sm',
  '[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-primary/10 [&_.ProseMirror_code]:px-1 [&_.ProseMirror_code]:py-0.5 [&_.ProseMirror_code]:font-mono [&_.ProseMirror_code]:text-[0.9em]',
  '[&_.ProseMirror_pre_code]:bg-transparent [&_.ProseMirror_pre_code]:p-0',
  '[&_.ProseMirror_table]:my-4 [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:border [&_.ProseMirror_table]:border-border',
  '[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:text-left [&_.ProseMirror_th]:font-semibold',
  '[&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:align-top',
)

function getVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      const videoId = parsed.hostname.includes('youtu.be')
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get('v')
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean).pop()
      return id ? `https://player.vimeo.com/video/${id}` : null
    }
    return url
  } catch {
    return null
  }
}

function formatBlockLabel(block: DraftBlock, index: number): string {
  return `${index + 1}. ${BLOCK_TYPE_LABELS[block.block_type]}`
}

function canManuallyCompleteBlock(block: DraftBlock): boolean {
  return (
    block.block_type !== 'question_stem' &&
    block.block_type !== 'question' &&
    block.block_type !== 'skill_trainer'
  )
}

function TextBlock({ block }: { block: DraftBlock }) {
  const content = (block.content ?? {}) as Record<string, unknown>
  const body = content.body as Record<string, unknown> | undefined
  const richBody = body && typeof body === 'object' && !Array.isArray(body) ? body : null

  return (
    <div className="max-h-[60vh] overflow-auto pr-2">
      <UcatRichContentBlock
        json={richBody}
        plainText=""
        className={LEARNING_TEXT_CONTENT_CLASSNAME}
        textTone="theme"
        paragraphSpacing
      />
    </div>
  )
}

function VideoBlock({ block }: { block: DraftBlock }) {
  const content = (block.content ?? {}) as { url?: string }
  const embedUrl = content.url ? getVideoEmbedUrl(content.url) : null

  if (!embedUrl) {
    return <p className="text-sm text-muted-foreground">Video URL not configured.</p>
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border">
      <iframe
        src={embedUrl}
        title="Lesson video"
        className="size-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

function FileBlock({ block }: { block: DraftBlock }) {
  const content = (block.content ?? {}) as { url?: string; label?: string }
  const label = content.label ?? 'Open file'

  return (
    <div className="space-y-3">
      {content.url ? (
        <iframe src={content.url} title={label} className="h-[50vh] w-full rounded-lg border" />
      ) : null}
      {content.url ? (
        <Button asChild variant="outline">
          <a href={content.url} target="_blank" rel="noreferrer">
            {label}
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">File not configured.</p>
      )}
    </div>
  )
}

function toRecordJson(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function detailQuestionToPreview(
  detail: NonNullable<ReturnType<typeof useUcatQuestionDetail>['data']>,
  questionId: string | null,
): UcatEnginePreviewQuestion | null {
  const sortedQuestions = [...(detail.questions ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
  const question = questionId ? sortedQuestions.find((item) => item.id === questionId) : sortedQuestions[0]
  if (!question) return null
  const questionIndex = sortedQuestions.findIndex((item) => item.id === question.id)

  return {
    id: question.id,
    questionNumber: questionIndex >= 0 ? questionIndex + 1 : 1,
    sectionDisplayColumns: detail.display_columns === 2 ? 2 : 1,
    stemText: proseMirrorToPlainText(detail.stem_text),
    stemJson: toRecordJson(detail.stem_text),
    questionText: proseMirrorToPlainText(question.question_text),
    questionJson: toRecordJson(question.question_text),
    questionType: question.question_type,
    options: [...(question.answer_options ?? [])]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((option, index) => ({
        id: option.id,
        index,
        text: proseMirrorToPlainText(option.answer_text),
        answerJson: toRecordJson(option.answer_text),
        isAnswer: option.is_answer,
        answerExplanation: proseMirrorToPlainText(option.answer_explanation),
        answerExplanationJson: toRecordJson(option.answer_explanation),
      })),
    answerExplanation: proseMirrorToPlainText(question.answer_explanation),
    answerExplanationJson: toRecordJson(question.answer_explanation),
  }
}

function LinkedQuestionPreview({
  block,
  stemOptions,
  questionOptions,
}: {
  block: DraftBlock
  stemOptions: StemOption[]
  questionOptions: UcatQuestionCatalogItem[]
}) {
  const [showAnswer, setShowAnswer] = useState(false)
  const stemLabel =
    stemOptions.find((stem) => stem.id === block.question_stem_id)?.text ??
    block.question_stem_id
  const selectedQuestion =
    block.block_type === 'question' && block.question_id
      ? questionOptions.find((question) => question.id === block.question_id)
      : null
  const questionLabel =
    selectedQuestion?.label ??
    block.question_id
  const stemId = block.block_type === 'question' ? selectedQuestion?.stemId ?? null : block.question_stem_id
  const questionId = block.block_type === 'question' ? block.question_id ?? null : null
  const detailQuery = useUcatQuestionDetail(stemId)
  const previewQuestion = detailQuery.data ? detailQuestionToPreview(detailQuery.data, questionId) : null

  if (!stemId) {
    return (
      <p className="text-sm text-muted-foreground">
        {block.block_type === 'question_stem' ? 'Question stem not configured.' : 'Question not configured.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">
          {block.block_type === 'question_stem'
            ? stemLabel ?? 'Question stem'
            : questionLabel ?? 'Question'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAnswer((prev) => !prev)}>
          {showAnswer ? 'Hide answers' : 'Show answers'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAnswer(false)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>
      <div className="h-[min(70vh,640px)] min-h-[420px] overflow-hidden rounded-lg border bg-background">
        {detailQuery.isLoading ? (
          <div className="flex size-full items-center justify-center p-6 text-sm text-muted-foreground">
            Loading question preview...
          </div>
        ) : previewQuestion ? (
          <UcatQuestionEnginePreview
            question={previewQuestion}
            showAnswerExplanations={showAnswer}
            interactive={false}
          />
        ) : (
          <div className="flex size-full items-center justify-center p-6 text-sm text-muted-foreground">
            Could not preview this question.
          </div>
        )}
      </div>
    </div>
  )
}

function SkillTrainerPreview({
  block,
  skillTrainers,
}: {
  block: DraftBlock
  skillTrainers: SkillTrainerOption[]
}) {
  const trainer = skillTrainers.find((item) => item.id === block.skill_trainer_id)
  const label = trainer?.name ?? trainer?.key ?? block.skill_trainer_id

  if (!block.skill_trainer_id) {
    return <p className="text-sm text-muted-foreground">Skill trainer not configured.</p>
  }

  return (
    <div className="space-y-3">
      <Button type="button" disabled>
        Start skill trainer
      </Button>
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        In ucat-web this starts a random skill trainer run.
        {label ? <span className="mt-2 block text-foreground">{label}</span> : null}
      </div>
    </div>
  )
}

function LessonBlockContent({
  block,
  stemOptions,
  questionOptions,
  skillTrainers,
}: {
  block: DraftBlock
  stemOptions: StemOption[]
  questionOptions: UcatQuestionCatalogItem[]
  skillTrainers: SkillTrainerOption[]
}) {
  if (block.block_type === 'text') return <TextBlock block={block} />
  if (block.block_type === 'video') return <VideoBlock block={block} />
  if (block.block_type === 'file') return <FileBlock block={block} />
  if (block.block_type === 'question_stem' || block.block_type === 'question') {
    return (
      <LinkedQuestionPreview
        block={block}
        stemOptions={stemOptions}
        questionOptions={questionOptions}
      />
    )
  }
  if (block.block_type === 'skill_trainer') {
    return <SkillTrainerPreview block={block} skillTrainers={skillTrainers} />
  }
  return null
}

function LessonContentsSidebar({
  blocks,
  activeIndex,
  onSelectBlock,
}: {
  blocks: DraftBlock[]
  activeIndex: number
  onSelectBlock: (index: number) => void
}) {
  return (
    <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-6 lg:w-72 lg:shrink-0 lg:self-start">
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-base font-semibold leading-none tracking-tight">Progress</h3>
        </div>
        <div className="space-y-3 p-6 pt-0">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-0 rounded-full bg-primary transition-all" />
          </div>
          <p className="text-sm text-muted-foreground">0% complete</p>
          <Button type="button" className="w-full" disabled>
            Mark lesson complete
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6">
          <h3 className="text-base font-semibold leading-none tracking-tight">Contents</h3>
        </div>
        <div className="space-y-1 p-6 pt-0">
          {blocks.map((block, index) => {
            const isActive = index === activeIndex
            const manualComplete = canManuallyCompleteBlock(block)
            return (
              <div
                key={block.clientId}
                className={cn(
                  'group flex items-center gap-2 rounded-md px-2 py-1.5',
                  isActive && 'bg-muted',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectBlock(index)}
                  className="min-w-0 flex-1 cursor-pointer text-left text-sm"
                >
                  <span className="line-clamp-2">{formatBlockLabel(block, index)}</span>
                </button>
                {manualComplete ? (
                  <button
                    type="button"
                    aria-label={`Mark block ${index + 1} complete`}
                    disabled
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </aside>
  )
}

export function UcatLearningModuleLessonPreview({
  title,
  description,
  blocks,
  stemOptions = [],
  questionOptions = [],
  skillTrainers = [],
}: UcatLearningModuleLessonPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const blockRefs = useRef(new Map<string, HTMLDivElement>())

  const setBlockRef = useCallback((blockId: string, element: HTMLDivElement | null) => {
    if (element) {
      blockRefs.current.set(blockId, element)
      return
    }
    blockRefs.current.delete(blockId)
  }, [])

  const goToBlock = useCallback(
    (index: number) => {
      setActiveIndex(index)
      const block = blocks[index]
      if (!block) return
      blockRefs.current.get(block.clientId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [blocks],
  )

  const titleText = title.trim() || 'Lesson'
  const descriptionText = description.trim()

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-background p-6">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-6">
            <header className="space-y-2">
              <Button type="button" variant="ghost" size="sm" className="-ml-2" disabled>
                <ArrowLeft className="mr-2 h-4 w-4" />
                All modules
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{titleText}</h1>
                {descriptionText ? (
                  <p className="mt-2 text-sm text-muted-foreground">{descriptionText}</p>
                ) : null}
              </div>
            </header>

            {blocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">This lesson has no blocks yet.</p>
            ) : (
              <div className="space-y-10">
                {blocks.map((block) => (
                  <div
                    key={block.clientId}
                    ref={(element) => setBlockRef(block.clientId, element)}
                    className="scroll-mt-24"
                  >
                    <LessonBlockContent
                      block={block}
                      stemOptions={stemOptions}
                      questionOptions={questionOptions}
                      skillTrainers={skillTrainers}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <LessonContentsSidebar
            blocks={blocks}
            activeIndex={activeIndex}
            onSelectBlock={goToBlock}
          />
        </div>
      </div>
    </div>
  )
}
