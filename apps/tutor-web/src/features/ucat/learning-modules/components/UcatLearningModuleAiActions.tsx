'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Json } from '@altitutor/shared'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchableSelect,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  useToast,
} from '@altitutor/ui'
import { FilePlus2, Info, Loader2, Wand2 } from 'lucide-react'
import {
  BLOCK_TYPE_LABELS,
  newDraftBlock,
  type DraftBlock,
} from '@/features/ucat/learning-modules/lib/learning-module-editor-types'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type AiRouteResponse = {
  body?: Json
  metadata?: Record<string, unknown>
  summary?: string | null
  originalText?: string
  error?: string
}

type PositionOption = {
  index: number
  label: string
}

type UcatLearningModuleAiActionsProps = {
  moduleId: string | null
  title: string
  description: string
  sectionId: string | null
  blocks: DraftBlock[]
  selectedBlockId: string | null
  editorMode: 'edit' | 'view'
  onInsertBlock: (block: DraftBlock, index: number) => void
  onUpdateBlock: (clientId: string, patch: Partial<DraftBlock>) => void
}

function AiActionButton({
  label,
  description,
  icon,
  onClick,
  disabled,
}: {
  label: string
  description: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-0 flex-1 justify-start gap-2"
        onClick={onClick}
        disabled={disabled}
      >
        {icon}
        {label}
      </Button>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={`${label} info`}
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

function blockLabel(block: DraftBlock, index: number): string {
  return `Block ${index + 1} · ${BLOCK_TYPE_LABELS[block.block_type]}`
}

function rewritePreviewText(value: Json | null | undefined): string {
  return proseMirrorToPlainText(value)?.trim() ?? ''
}

export function UcatLearningModuleAiActions({
  moduleId,
  title,
  description,
  sectionId,
  blocks,
  selectedBlockId,
  editorMode,
  onInsertBlock,
  onUpdateBlock,
}: UcatLearningModuleAiActionsProps) {
  const { toast } = useToast()
  const [generateOpen, setGenerateOpen] = useState(false)
  const [rewriteOpen, setRewriteOpen] = useState(false)
  const [teachingIntent, setTeachingIntent] = useState('')
  const [rewriteInstruction, setRewriteInstruction] = useState('')
  const [targetIndex, setTargetIndex] = useState(0)
  const [pending, setPending] = useState<'generate' | 'rewrite' | null>(null)
  const [rewritePreview, setRewritePreview] = useState<{
    body: Json
    metadata: Record<string, unknown>
    summary: string | null
    originalText: string
  } | null>(null)

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.clientId === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  )
  const selectedBlockIndex = selectedBlock
    ? blocks.findIndex((block) => block.clientId === selectedBlock.clientId)
    : -1
  const selectedTextBlock = selectedBlock?.block_type === 'text' ? selectedBlock : null

  const positionOptions = useMemo<PositionOption[]>(
    () => [
      { index: 0, label: 'Beginning of lesson' },
      ...blocks.map((block, index) => ({
        index: index + 1,
        label: `After ${blockLabel(block, index)}`,
      })),
    ],
    [blocks],
  )

  useEffect(() => {
    if (!generateOpen) return
    setTargetIndex(selectedBlockIndex >= 0 ? selectedBlockIndex + 1 : blocks.length)
  }, [blocks.length, generateOpen, selectedBlockIndex])

  const modulePayload = {
    moduleId,
    title,
    description,
    sectionId,
  }

  async function handleGenerate() {
    const intent = teachingIntent.trim()
    if (!intent) return
    const position =
      positionOptions.find((item) => item.index === targetIndex) ??
      positionOptions[positionOptions.length - 1]
    setPending('generate')
    try {
      const response = await fetch('/api/ucat/learning-modules/ai-tools/generate-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: modulePayload,
          blocks,
          teachingIntent: intent,
          targetIndex,
          targetPositionLabel: position?.label ?? null,
        }),
      })
      const json = (await response.json()) as AiRouteResponse
      if (!response.ok || !json.body) {
        throw new Error(json.error ?? 'Lesson text generation failed')
      }
      const block = newDraftBlock('text')
      onInsertBlock(
        {
          ...block,
          content: {
            ...block.content,
            body: json.body,
            aiGenerationMetadata: json.metadata ?? null,
          },
        },
        targetIndex,
      )
      setGenerateOpen(false)
      setTeachingIntent('')
      toast({ description: json.summary ?? 'Generated text block inserted. Review before saving.' })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Lesson text generation failed',
        variant: 'destructive',
      })
    } finally {
      setPending(null)
    }
  }

  async function handleRewrite() {
    if (!selectedTextBlock) return
    setPending('rewrite')
    try {
      const response = await fetch('/api/ucat/learning-modules/ai-tools/rewrite-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module: modulePayload,
          blocks,
          selectedBlockId: selectedTextBlock.clientId,
          rewriteInstruction: rewriteInstruction.trim() || null,
        }),
      })
      const json = (await response.json()) as AiRouteResponse
      if (!response.ok || !json.body) {
        throw new Error(json.error ?? 'Lesson text rewrite failed')
      }
      setRewritePreview({
        body: json.body,
        metadata: json.metadata ?? {},
        summary: json.summary ?? null,
        originalText:
          json.originalText ??
          rewritePreviewText((selectedTextBlock.content.body as Json | null) ?? null),
      })
      setRewriteOpen(false)
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Lesson text rewrite failed',
        variant: 'destructive',
      })
    } finally {
      setPending(null)
    }
  }

  function handleApplyRewrite() {
    if (!selectedTextBlock || !rewritePreview) return
    onUpdateBlock(selectedTextBlock.clientId, {
      content: {
        ...selectedTextBlock.content,
        body: rewritePreview.body,
        aiGenerationMetadata: rewritePreview.metadata,
      },
    })
    setRewritePreview(null)
    setRewriteInstruction('')
    toast({ description: 'Rewrite applied. Review before saving.' })
  }

  const disabled = editorMode !== 'edit' || pending != null

  return (
    <>
      <div className="space-y-2">
        <AiActionButton
          label="Generate text block"
          description="Creates a new unsaved rich text block from your teaching intent, target lesson position, and surrounding lesson context."
          icon={pending === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
          onClick={() => setGenerateOpen(true)}
          disabled={disabled}
        />
        <AiActionButton
          label="Rewrite text block"
          description="Rewrites the selected text block to reduce source similarity while preserving meaning. You review before applying."
          icon={pending === 'rewrite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          onClick={() => setRewriteOpen(true)}
          disabled={disabled || !selectedTextBlock}
        />
      </div>

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate text block</DialogTitle>
            <DialogDescription>
              Add a rich text block to the lesson draft. The chosen position is included in the AI brief.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Teaching intent</label>
              <Textarea
                value={teachingIntent}
                onChange={(event) => setTeachingIntent(event.target.value)}
                rows={5}
                placeholder="What should this block teach or clarify?"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Insert position</label>
              <SearchableSelect<PositionOption>
                items={positionOptions}
                value={positionOptions.find((item) => item.index === targetIndex) ?? null}
                onValueChange={(item) => setTargetIndex(item?.index ?? blocks.length)}
                getItemLabel={(item) => item.label}
                getItemId={(item) => String(item.index)}
                placeholder="Select position"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={pending === 'generate' || !teachingIntent.trim()}
            >
              {pending === 'generate' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rewriteOpen} onOpenChange={setRewriteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rewrite text block</DialogTitle>
            <DialogDescription>
              Rewrite the selected text block. Meaning and factual claims should be preserved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Selected block</p>
              <p className="line-clamp-5 whitespace-pre-wrap text-sm">
                {rewritePreviewText((selectedTextBlock?.content.body as Json | null) ?? null) || 'No text selected'}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Optional instruction</label>
              <Textarea
                value={rewriteInstruction}
                onChange={(event) => setRewriteInstruction(event.target.value)}
                rows={4}
                placeholder="e.g. Make it more step-by-step for weaker students."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRewriteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleRewrite()}
              disabled={pending === 'rewrite' || !selectedTextBlock}
            >
              {pending === 'rewrite' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Rewrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rewritePreview != null} onOpenChange={(open) => !open && setRewritePreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Review rewritten text</DialogTitle>
            <DialogDescription>
              Apply the rewrite to the local lesson draft, or close to keep the current block unchanged.
            </DialogDescription>
          </DialogHeader>
          {rewritePreview?.summary ? (
            <p className="text-sm text-muted-foreground">{rewritePreview.summary}</p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="min-w-0 rounded-md border p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Current</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                {rewritePreview?.originalText ?? ''}
              </pre>
            </div>
            <div className="min-w-0 rounded-md border p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Rewritten</p>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
                {rewritePreviewText(rewritePreview?.body ?? null)}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRewritePreview(null)}>
              Reject
            </Button>
            <Button type="button" onClick={handleApplyRewrite}>
              Apply rewrite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
