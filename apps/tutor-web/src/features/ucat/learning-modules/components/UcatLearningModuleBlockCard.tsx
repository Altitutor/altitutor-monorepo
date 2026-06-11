'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import type { Json } from '@altitutor/shared'
import type { Editor } from '@tiptap/react'
import { Button, Input, Label, SearchableSelect, Switch, useToast } from '@altitutor/ui'
import { ArrowDown, ArrowUp, Loader2, Trash2, Upload } from 'lucide-react'
import { uploadLearningModuleFile } from '@/features/ucat/learning-modules/api/files'
import {
  BLOCK_TYPE_LABELS,
  type DraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import type { UcatQuestionCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatRichTextEditor } from '@/features/ucat/shared/UcatRichTextEditor'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatSkillTrainerSetRow } from '@/features/ucat/skill-trainer-sets/types'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'

type StemOption = { id: string; text: string }

type UcatLearningModuleBlockCardProps = {
  block: DraftBlock
  index: number
  totalBlocks: number
  moduleId: string | null
  stemOptions: StemOption[]
  questionOptions: UcatQuestionCatalogItem[]
  skillTrainerSets: UcatSkillTrainerSetRow[]
  popoverContainer?: HTMLElement | null
  isHighlighted?: boolean
  onUpdate: (patch: Partial<DraftBlock>) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
  onTextEditorActive?: (editor: Editor | null) => void
}

export const UcatLearningModuleBlockCard = forwardRef<
  HTMLDivElement,
  UcatLearningModuleBlockCardProps
>(function UcatLearningModuleBlockCard(
  {
    block,
    index,
    totalBlocks,
    moduleId,
    stemOptions,
    questionOptions,
    skillTrainerSets,
    popoverContainer,
    isHighlighted,
    onUpdate,
    onMoveUp,
    onMoveDown,
    onRemove,
    onTextEditorActive,
  },
  ref,
) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    if (!isHighlighted || !ref || typeof ref === 'function') return
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [isHighlighted, ref])

  const selectedStem =
    block.question_stem_id != null
      ? (stemOptions.find((s) => s.id === block.question_stem_id) ?? {
          id: block.question_stem_id,
          text: block.question_stem_id,
        })
      : null

  const selectedQuestion =
    block.question_id != null
      ? (questionOptions.find((q) => q.id === block.question_id) ?? {
          id: block.question_id,
          label: block.question_id,
          stemId: '',
          sectionName: '',
          questionType: '',
        })
      : null

  const selectedSkillTrainerSet =
    block.skill_trainer_set_id != null
      ? (skillTrainerSets
          .filter((s) => s.id === block.skill_trainer_set_id)
          .map((s) => ({ id: s.id, label: `${s.trainer_name}: ${s.name}` }))[0] ?? {
          id: block.skill_trainer_set_id,
          label: block.skill_trainer_set_id,
        })
      : null

  async function handleFileUpload(file: File) {
    if (!moduleId) {
      toast({
        title: 'Cannot upload file',
        description: 'Save the module first before uploading files.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)
    try {
      const result = await uploadLearningModuleFile(moduleId, file)
      onUpdate({
        file_id: result.fileId,
        content: {
          ...block.content,
          label: result.filename,
          url: result.signedUrl,
        },
      })
      toast({ title: 'File uploaded' })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload file',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div
      ref={ref}
      className={cn(
        tutorCardCn('overflow-hidden'),
        isHighlighted && 'ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-3 py-2 dark:border-white/10">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            Block {index + 1} · {BLOCK_TYPE_LABELS[block.block_type]}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === 0}
            onClick={onMoveUp}
            aria-label={`Move block ${index + 1} up`}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={index === totalBlocks - 1}
            onClick={onMoveDown}
            aria-label={`Move block ${index + 1} down`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 !text-destructive hover:!text-destructive hover:bg-destructive/10"
            onClick={onRemove}
            aria-label={`Delete block ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Require completion</span>
          <Switch
            checked={block.require_completion_before_next}
            onCheckedChange={(checked) =>
              onUpdate({ require_completion_before_next: checked })
            }
          />
        </div>

        {block.block_type === 'text' ? (
          <UcatRichTextEditor
            value={(block.content.body as Json) ?? plainTextToProseMirror('')}
            onChange={(body) => onUpdate({ content: { body } })}
            minHeight="120px"
            onEditorReady={(editor) => {
              const handleFocus = () => onTextEditorActive?.(editor)
              const handleBlur = () => {
                window.setTimeout(() => {
                  const active = document.activeElement
                  if (active?.closest('[data-rich-text-toolbar]')) return
                  onTextEditorActive?.(null)
                }, 0)
              }
              editor.on('focus', handleFocus)
              editor.on('blur', handleBlur)
            }}
          />
        ) : null}

        {block.block_type === 'video' ? (
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input
              value={String(block.content.url ?? '')}
              onChange={(e) => onUpdate({ content: { url: e.target.value } })}
              placeholder="https://youtube.com/…"
            />
          </div>
        ) : null}

        {block.block_type === 'file' ? (
          <div className="space-y-2">
            <Label>File</Label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFileUpload(file)
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading || !moduleId}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {block.file_id ? 'Replace file' : 'Upload file'}
              </Button>
              {block.file_id ? (
                <span className="text-sm text-muted-foreground">
                  {String(block.content.label ?? 'Uploaded file')}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">No file uploaded</span>
              )}
            </div>
            <Label>Link label</Label>
            <Input
              value={String(block.content.label ?? '')}
              onChange={(e) =>
                onUpdate({ content: { ...block.content, label: e.target.value } })
              }
              placeholder="Open file"
            />
          </div>
        ) : null}

        {block.block_type === 'question_stem' ? (
          <div className="space-y-2">
            <Label>Question stem</Label>
            <SearchableSelect<{ id: string; text: string }>
              items={stemOptions}
              value={selectedStem}
              onValueChange={(item) =>
                onUpdate({
                  question_stem_id: item?.id ?? null,
                })
              }
              getItemLabel={(s) => (s.text.length > 40 ? `${s.text.slice(0, 37)}…` : s.text)}
              getItemId={(s) => s.id}
              placeholder="Select stem"
              searchPlaceholder="Search stems..."
              allowClear
              popoverContainer={popoverContainer}
            />
          </div>
        ) : null}

        {block.block_type === 'question' ? (
          <div className="space-y-2">
            <Label>Question</Label>
            <SearchableSelect<UcatQuestionCatalogItem>
              items={questionOptions}
              value={selectedQuestion}
              onValueChange={(item) => onUpdate({ question_id: item?.id ?? null })}
              getItemLabel={(q) => q.label}
              getItemId={(q) => q.id}
              getItemValue={(q) => `${q.label} ${q.sectionName} ${q.questionType}`}
              placeholder="Select question"
              searchPlaceholder="Search questions..."
              allowClear
              popoverContainer={popoverContainer}
            />
          </div>
        ) : null}

        {block.block_type === 'skill_trainer_set' ? (
          <div className="space-y-2">
            <Label>Skill trainer set</Label>
            <SearchableSelect<{ id: string; label: string }>
              items={skillTrainerSets.map((s) => ({
                id: s.id,
                label: `${s.trainer_name}: ${s.name}`,
              }))}
              value={selectedSkillTrainerSet}
              onValueChange={(item) => {
                const setId = item?.id ?? null
                const set = skillTrainerSets.find((s) => s.id === setId)
                onUpdate({
                  skill_trainer_set_id: setId,
                  content: {
                    ...block.content,
                    trainerKey: set?.trainer_key ?? undefined,
                  },
                })
              }}
              getItemLabel={(s) => s.label}
              getItemId={(s) => s.id}
              placeholder="Select set"
              searchPlaceholder="Search sets..."
              allowClear
              popoverContainer={popoverContainer}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
})
