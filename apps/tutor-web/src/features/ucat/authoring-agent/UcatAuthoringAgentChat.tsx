'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SearchableSelect,
  Textarea,
  useToast,
} from '@altitutor/ui'
import { Bot, Check, ChevronDown, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'
import { cn } from '@/shared/utils'
import type {
  UcatAuthoringAgentContextType,
  UcatAuthoringAgentResponse,
  UcatAuthoringAgentScope,
  UcatAuthoringAgentStreamEvent,
  UcatAuthoringChatMessage,
  UcatAuthoringToolCall,
  UcatAuthoringToolExecutor,
  UcatAuthoringToolResult,
} from '@/features/ucat/authoring-agent/types'
import type { Json } from '@altitutor/shared'
import { useUcatGenerationModelProfiles } from '@/features/ucat/questions/hooks/useUcatQuestions'

type UcatAuthoringAgentChatProps = {
  contextType: UcatAuthoringAgentContextType
  scope: UcatAuthoringAgentScope
  scopeLabel: string
  snapshot: Json
  conversationKey?: string | null
  selectedImage?: {
    label: string
    src?: string | null
    fileId?: string | null
    location?: string | null
    visualType?: string | null
    visualSpec?: Json | null
    visualTitle?: string | null
    visualAltText?: string | null
  } | null
  placeholder?: string
  className?: string
  onExecuteTool: UcatAuthoringToolExecutor
  onAcceptImagePreview?: (imageNode: Json) => Promise<{ ok: boolean; message: string }> | { ok: boolean; message: string }
}

type PersistedChatState = {
  messages: UcatAuthoringChatMessage[]
  input: string
  toolResults: Record<string, UcatAuthoringToolResult>
  pausedRuns: Record<string, UcatAuthoringChatMessage[]>
  modelProfileId: string | null
}

const persistedChatStates = new Map<string, PersistedChatState>()

type AuthoringQuickAction = {
  id: 'paraphrase' | 'explain-answer'
  label: string
  description: string
  prompt: string
  contexts: UcatAuthoringAgentContextType[]
}

const AUTHORING_QUICK_ACTIONS: AuthoringQuickAction[] = [
  {
    id: 'paraphrase',
    label: 'Paraphrase',
    description: 'Copyright-safe rewrite of the full stem package.',
    prompt: 'Paraphrase',
    contexts: ['question_stem', 'generated_review'],
  },
  {
    id: 'explain-answer',
    label: 'Explain answer',
    description: 'Improve the answer explanation step by step.',
    prompt:
      'Improve the current question answer explanation. Keep the question, answer options, and correct answer unchanged. Make the explanation student-friendly and step-by-step, explicitly explaining why the correct answer is correct and why the distractors are wrong. Apply the edit directly using the appropriate explanation update tool.',
    contexts: ['question_stem', 'generated_review'],
  },
]

function createMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function toolRequiresConfirmation(toolCall: UcatAuthoringToolCall) {
  return toolCall.requiresConfirmation || toolCall.name.toLowerCase().startsWith('delete')
}

function toolCompletesRun(toolCall: UcatAuthoringToolCall, result: UcatAuthoringToolResult) {
  const output = result.output
  const isPreview = Boolean(output && typeof output === 'object' && !Array.isArray(output) && output.kind === 'image_preview')
  return result.ok && (toolCall.name === 'bulkParaphraseStem' || isPreview)
}

const TOOL_LABELS: Record<string, string> = {
  updateStemText: 'Update Stem Text',
  bulkParaphraseStem: 'Paraphrase Full Stem',
  updateStemProperties: 'Update Stem Properties',
  updateQuestionText: 'Update Question Text',
  insertQuestion: 'Add Question',
  updateQuestionProperties: 'Update Question Properties',
  updateQuestionTags: 'Update Question Tags',
  insertAnswerOption: 'Add Answer Option',
  updateAnswerOption: 'Update Answer Option',
  markCorrectAnswer: 'Mark Correct Answer',
  updateAnswerExplanation: 'Update Explanation',
  deleteQuestion: 'Delete Question',
  deleteAnswerOption: 'Delete Answer Option',
  updateLessonMetadata: 'Update Lesson Details',
  insertTextBlock: 'Add Text Block',
  updateTextBlock: 'Update Text Block',
  insertQuestionStemBlock: 'Add Stem Block',
  insertQuestionBlock: 'Add Question Block',
  searchQuestionStemCandidates: 'Search Stem Candidates',
  searchQuestionCandidates: 'Search Question Candidates',
  generateAndLinkAssessment: 'Generate Assessment Placeholder',
  insertSkillTrainerBlock: 'Add Skill Trainer Block',
  moveBlock: 'Move Block',
  updateBlockGate: 'Update Completion Gate',
  deleteBlock: 'Delete Block',
  updateReviewCandidateStemText: 'Update Review Stem',
  updateReviewCandidateQuestionText: 'Update Review Question',
  updateReviewCandidateQuestionProperties: 'Update Review Question Properties',
  updateReviewCandidateAnswerOption: 'Update Review Answer Option',
  updateReviewCandidateExplanation: 'Update Review Explanation',
  deleteReviewCandidate: 'Delete Review Candidate',
  insertImage: 'Generate Image',
  replaceImageFromPrompt: 'Replace Image',
  replaceVisualSpec: 'Insert Deterministic Visual',
  reviseSelectedImage: 'Preview AI Image Revision',
  previewSelectedImageConversion: 'Preview Editable Visual',
}

function toolLabel(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/([a-z])([A-Z])/gu, '$1 $2')
}

async function readAgentStream(response: Response, onEvent: (event: UcatAuthoringAgentStreamEvent) => void) {
  if (!response.body) throw new Error('AI authoring stream did not start')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const events = buffer.split('\n\n')
    buffer = events.pop() ?? ''
    for (const rawEvent of events) {
      const eventType = rawEvent.split('\n').find((line) => line.startsWith('event: '))?.slice(7)
      const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '))
      if (!eventType || !dataLine) continue
      onEvent({ type: eventType, ...JSON.parse(dataLine.slice(6)) } as UcatAuthoringAgentStreamEvent)
    }
  }
}

function createToolResultMessage(toolCall: UcatAuthoringToolCall, result: UcatAuthoringToolResult): UcatAuthoringChatMessage {
  return {
    id: createMessageId(),
    role: 'tool',
    content: result.message,
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    toolResult: result,
  }
}

function ToolCard({
  toolCall,
  onApprove,
  onDeny,
  isPending,
  result,
  onUsePreview,
  onTryPreviewAgain,
  onCancelPreview,
}: {
  toolCall: UcatAuthoringToolCall
  onApprove: () => void
  onDeny: () => void
  isPending: boolean
  result?: UcatAuthoringToolResult | null
  onUsePreview: () => void
  onTryPreviewAgain: () => void
  onCancelPreview: () => void
}) {
  const isDelete = toolCall.name.toLowerCase().includes('delete')
  const requiresConfirmation = toolRequiresConfirmation(toolCall)
  const preview = result?.output && typeof result.output === 'object' && !Array.isArray(result.output) && result.output.kind === 'image_preview'
    ? result.output as Record<string, Json>
    : null
  const originalSrc = preview && typeof preview.originalSrc === 'string' ? preview.originalSrc : null
  const imageNode = preview && preview.imageNode && typeof preview.imageNode === 'object' && !Array.isArray(preview.imageNode)
    ? preview.imageNode as Record<string, Json>
    : null
  const imageAttrs = imageNode?.attrs && typeof imageNode.attrs === 'object' && !Array.isArray(imageNode.attrs)
    ? imageNode.attrs as Record<string, Json>
    : null
  const previewSrc = imageAttrs && typeof imageAttrs.src === 'string' ? imageAttrs.src : null
  const previewStatus = preview && typeof preview.status === 'string' ? preview.status : null
  return (
    <div className="rounded-md border border-black/[0.08] bg-background p-2 text-xs shadow-sm dark:border-white/10">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
            isDelete ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
          )}
        >
          {isDelete ? <Trash2 className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{toolLabel(toolCall.name)}</div>
          <div className="mt-0.5 leading-relaxed text-muted-foreground">{toolCall.summary}</div>
          {result ? (
            <>
              <div className={cn('mt-2 text-xs', result.ok ? 'text-emerald-700' : 'text-destructive')}>
                {result.message}
              </div>
              {preview && originalSrc && previewSrc ? (
                <div className="mt-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <figure className="space-y-1">
                      <figcaption className="text-muted-foreground">Original</figcaption>
                      {/* Signed and data-URI authoring previews cannot use the configured Next image loader. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={originalSrc} alt="Original selected visual" className="aspect-video w-full rounded border bg-white object-contain" />
                    </figure>
                    <figure className="space-y-1">
                      <figcaption className="text-muted-foreground">Preview</figcaption>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewSrc} alt="Generated visual preview" className="aspect-video w-full rounded border bg-white object-contain" />
                    </figure>
                  </div>
                  {!previewStatus ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" className="h-7 text-xs" onClick={onUsePreview}>Use this image</Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onTryPreviewAgain}>Try again</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelPreview}>Cancel</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : requiresConfirmation ? (
            <div className="mt-2 flex items-center gap-2">
              <Button type="button" size="sm" className="h-7 gap-1 text-xs" onClick={onApprove} disabled={isPending}>
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Approve
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onDeny} disabled={isPending}>
                <X className="h-3.5 w-3.5" />
                Deny
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function UcatAuthoringAgentChat({
  contextType,
  scope,
  scopeLabel,
  snapshot,
  conversationKey = null,
  selectedImage = null,
  placeholder = 'Ask AI to edit this draft...',
  className,
  onExecuteTool,
  onAcceptImagePreview,
}: UcatAuthoringAgentChatProps) {
  const { toast } = useToast()
  const initialPersistedState = conversationKey ? persistedChatStates.get(conversationKey) : null
  const [messages, setMessages] = useState<UcatAuthoringChatMessage[]>(initialPersistedState?.messages ?? [])
  const [input, setInput] = useState(initialPersistedState?.input ?? '')
  const [isSending, setIsSending] = useState(false)
  const [activityStatus, setActivityStatus] = useState<string | null>(null)
  const [pendingToolId, setPendingToolId] = useState<string | null>(null)
  const [toolResults, setToolResults] = useState<Record<string, UcatAuthoringToolResult>>(initialPersistedState?.toolResults ?? {})
  const [pausedRuns, setPausedRuns] = useState<Record<string, UcatAuthoringChatMessage[]>>(initialPersistedState?.pausedRuns ?? {})
  const [modelProfileId, setModelProfileId] = useState<string | null>(initialPersistedState?.modelProfileId ?? null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const snapshotRef = useRef<Json>(snapshot)
  const conversationKeyRef = useRef<string | null>(conversationKey)
  const modelProfilesQuery = useUcatGenerationModelProfiles(true)
  const modelProfiles = useMemo(
    () => modelProfilesQuery.data?.modelProfiles ?? [],
    [modelProfilesQuery.data?.modelProfiles],
  )

  const activePills = useMemo(
    () => [scopeLabel, selectedImage?.label].filter((value): value is string => Boolean(value)),
    [scopeLabel, selectedImage],
  )
  const quickActions = useMemo(
    () => AUTHORING_QUICK_ACTIONS.filter((action) => action.contexts.includes(contextType)),
    [contextType],
  )

  useEffect(() => {
    if (modelProfileId || modelProfiles.length === 0) return
    setModelProfileId(modelProfiles.find((profile) => profile.isDefault)?.id ?? modelProfiles[0]?.id ?? null)
  }, [modelProfileId, modelProfiles])

  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])

  useEffect(() => {
    if (conversationKeyRef.current === conversationKey) return
    conversationKeyRef.current = conversationKey
    const persisted = conversationKey ? persistedChatStates.get(conversationKey) : null
    setMessages(persisted?.messages ?? [])
    setInput(persisted?.input ?? '')
    setToolResults(persisted?.toolResults ?? {})
    setPausedRuns(persisted?.pausedRuns ?? {})
    setModelProfileId(persisted?.modelProfileId ?? null)
    setActivityStatus(null)
    setPendingToolId(null)
  }, [conversationKey])

  useEffect(() => {
    if (!conversationKey) return
    if (conversationKeyRef.current !== conversationKey) return
    persistedChatStates.set(conversationKey, {
      messages,
      input,
      toolResults,
      pausedRuns,
      modelProfileId,
    })
  }, [conversationKey, input, messages, modelProfileId, pausedRuns, toolResults])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
  }, [messages, toolResults, pendingToolId, isSending, activityStatus])

  async function executeTool(toolCall: UcatAuthoringToolCall): Promise<UcatAuthoringToolResult> {
    setPendingToolId(toolCall.id)
    try {
      const result = await onExecuteTool(toolCall)
      setToolResults((current) => ({
        ...current,
        [toolCall.id]: result,
      }))
      if (!result.ok) {
        toast({ description: result.message, variant: 'destructive' })
      }
      return {
        toolCallId: toolCall.id,
        ok: result.ok,
        message: result.message,
        output: result.output,
      }
    } finally {
      setPendingToolId(null)
    }
  }

  async function requestAgentStep(conversation: UcatAuthoringChatMessage[]): Promise<UcatAuthoringAgentResponse> {
    const response = await fetch('/api/ucat/authoring-agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ucat-agent-stream': '1',
      },
      body: JSON.stringify({
        contextType,
        scope,
        scopeLabel,
        modelProfileId,
        selectedImage,
        snapshot: snapshotRef.current,
        messages: conversation,
      }),
    })
    if (!response.ok) {
      const json = (await response.json()) as { error?: string }
      throw new Error(json.error ?? 'AI authoring failed')
    }

    let stepResponse: UcatAuthoringAgentResponse | null = null
    await readAgentStream(response, (event) => {
      if (event.type === 'status') {
        setActivityStatus(event.message)
      }
      if (event.type === 'step') {
        stepResponse = event.response
        setActivityStatus(null)
      }
      if (event.type === 'error') throw new Error(event.message)
    })

    const resolvedStep = stepResponse
    if (!resolvedStep) throw new Error('AI authoring failed before returning an agent step')
    return resolvedStep
  }

  async function runAgentLoop(initialConversation: UcatAuthoringChatMessage[]) {
    let conversation = initialConversation
    const maxSteps = 12

    for (let step = 0; step < maxSteps; step += 1) {
      setActivityStatus(step === 0 ? 'Reading the current draft...' : 'Checking the tool result...')
      const response = await requestAgentStep(conversation)
      const assistantMessage: UcatAuthoringChatMessage = {
        id: createMessageId(),
        role: 'assistant',
        content: response.message,
        toolCalls: response.toolCalls,
      }
      conversation = [...conversation, assistantMessage]
      setMessages((current) => [...current, assistantMessage])

      const confirmationTools = response.toolCalls.filter(toolRequiresConfirmation)
      if (confirmationTools.length > 0) {
        setPausedRuns((current) => {
          const next = { ...current }
          for (const toolCall of confirmationTools) next[toolCall.id] = conversation
          return next
        })
        return
      }

      if (response.toolCalls.length === 0 || response.status === 'final') return

      let completedRun = false
      for (const toolCall of response.toolCalls) {
        const result = await executeTool(toolCall)
        const toolResultMessage = createToolResultMessage(toolCall, result)
        conversation = [...conversation, toolResultMessage]
        setMessages((current) => [...current, toolResultMessage])
        if (toolCompletesRun(toolCall, result)) completedRun = true
      }
      if (completedRun) return
    }

    throw new Error('AI authoring stopped after too many tool steps. Try a smaller request.')
  }

  async function continueAfterToolDecision(toolCall: UcatAuthoringToolCall, approved: boolean) {
    const pausedConversation = pausedRuns[toolCall.id]
    if (!pausedConversation || isSending) return

    setIsSending(true)
    try {
      let result: UcatAuthoringToolResult
      if (approved) {
        result = await executeTool(toolCall)
      } else {
        result = {
          toolCallId: toolCall.id,
          ok: false,
          message: 'Denied by tutor.',
        }
        setToolResults((current) => ({
          ...current,
          [toolCall.id]: result,
        }))
      }
      setPausedRuns((current) => {
        const next = { ...current }
        delete next[toolCall.id]
        return next
      })
      const toolResultMessage = createToolResultMessage(toolCall, result)
      setMessages((current) => [...current, toolResultMessage])
      await runAgentLoop([...pausedConversation, toolResultMessage])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI authoring failed'
      toast({ description: message, variant: 'destructive' })
      setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: message }])
    } finally {
      setIsSending(false)
    }
  }

  async function submitAgentInstruction(text: string, options?: { clearInput?: boolean }) {
    const trimmedText = text.trim()
    if (!trimmedText || isSending) return

    const userMessage: UcatAuthoringChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedText,
    }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    if (options?.clearInput ?? true) setInput('')
    setIsSending(true)

    try {
      await runAgentLoop(nextMessages)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI authoring failed'
      toast({ description: message, variant: 'destructive' })
      setMessages((current) => [...current, { id: createMessageId(), role: 'assistant', content: message }])
    } finally {
      setActivityStatus(null)
      setIsSending(false)
    }
  }

  async function submitMessage() {
    await submitAgentInstruction(input, { clearInput: true })
  }

  async function runQuickAction(action: AuthoringQuickAction) {
    await submitAgentInstruction(action.prompt, { clearInput: false })
  }

  async function applyImagePreview(toolCall: UcatAuthoringToolCall) {
    const result = toolResults[toolCall.id]
    const output = result?.output
    if (!result || !output || typeof output !== 'object' || Array.isArray(output)) return
    const imageNode = output.imageNode
    if (!imageNode || typeof imageNode !== 'object' || Array.isArray(imageNode) || !onAcceptImagePreview) return
    const accepted = await onAcceptImagePreview(imageNode as Json)
    setToolResults((current) => ({
      ...current,
      [toolCall.id]: {
        ...result,
        ok: accepted.ok,
        message: accepted.message,
        output: { ...output, status: accepted.ok ? 'accepted' : 'failed' } as Json,
      },
    }))
    if (!accepted.ok) toast({ description: accepted.message, variant: 'destructive' })
  }

  function retryImagePreview(toolCall: UcatAuthoringToolCall) {
    const instructions = typeof toolCall.input.instructions === 'string' ? toolCall.input.instructions : ''
    setInput(instructions ? `Try again, with these revised instructions: ${instructions}` : 'Try again with these changes: ')
    const result = toolResults[toolCall.id]
    if (result?.output && typeof result.output === 'object' && !Array.isArray(result.output)) {
      const output = result.output as Record<string, Json>
      setToolResults((current) => ({
        ...current,
        [toolCall.id]: { ...result, message: 'Preview not applied. Edit the instructions below and send again.', output: { ...output, status: 'retrying' } as Json },
      }))
    }
  }

  function cancelImagePreview(toolCall: UcatAuthoringToolCall) {
    const result = toolResults[toolCall.id]
    if (result?.output && typeof result.output === 'object' && !Array.isArray(result.output)) {
      const output = result.output as Record<string, Json>
      setToolResults((current) => ({
        ...current,
        [toolCall.id]: { ...result, message: 'Preview cancelled; the draft image was not changed.', output: { ...output, status: 'cancelled' } as Json },
      }))
    }
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col gap-3', className)}>
      <div className="flex flex-wrap gap-1.5">
        {activePills.map((pill) => (
          <span key={pill} className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground">
            {pill}
          </span>
        ))}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-md border bg-muted/20 p-3">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
            Ask for edits. AI changes the local draft; Save still controls persistence.
          </div>
        ) : (
          messages.filter((message) => message.role !== 'tool').map((message) => (
            <Fragment key={message.id}>
              {message.content.trim() ? (
                <div
                  className={cn(
                    'max-w-[92%] space-y-2 rounded-md px-3 py-2 text-sm break-words',
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'mr-auto border bg-background text-foreground',
                  )}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{message.content}</div>
                </div>
              ) : null}
              {message.role === 'assistant' && message.toolCalls?.length
                ? message.toolCalls.map((toolCall) => (
                  <div key={toolCall.id} className="mr-auto max-w-[92%] rounded-md">
                    <ToolCard
                      toolCall={toolCall}
                      isPending={pendingToolId === toolCall.id}
                      result={toolResults[toolCall.id] ?? null}
                      onApprove={() => void continueAfterToolDecision(toolCall, true)}
                      onDeny={() => void continueAfterToolDecision(toolCall, false)}
                      onUsePreview={() => void applyImagePreview(toolCall)}
                      onTryPreviewAgain={() => retryImagePreview(toolCall)}
                      onCancelPreview={() => cancelImagePreview(toolCall)}
                    />
                  </div>
                ))
                : null}
            </Fragment>
          ))
        )}
        {activityStatus ? (
          <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{activityStatus}</span>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border bg-background p-2 shadow-sm">
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={placeholder}
          className="min-h-20 resize-none border-0 bg-transparent p-2 text-sm shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              void submitMessage()
            }
          }}
        />
        <div className="flex items-center justify-between gap-2 border-t pt-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {quickActions.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-md bg-muted/40 px-2 text-xs"
                    disabled={isSending}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Skills
                    <ChevronDown className="h-3 w-3 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>AI skills</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {quickActions.map((action) => (
                    <DropdownMenuItem
                      key={action.id}
                      className="flex cursor-pointer flex-col items-start gap-0.5 whitespace-normal"
                      onSelect={() => void runQuickAction(action)}
                    >
                      <span className="text-sm font-medium">{action.label}</span>
                      <span className="text-xs leading-snug text-muted-foreground">{action.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <div className="min-w-0 flex-1 [&_button]:h-8 [&_button]:rounded-md [&_button]:bg-muted/40 [&_button]:text-xs">
              <SearchableSelect<(typeof modelProfiles)[number]>
                items={modelProfiles}
                value={modelProfiles.find((profile) => profile.id === modelProfileId) ?? null}
                onValueChange={(profile) => setModelProfileId(profile?.id ?? null)}
                getItemId={(profile) => profile.id}
                getItemLabel={(profile) => profile.name}
                placeholder={modelProfilesQuery.isLoading ? 'Loading models...' : 'Model'}
                searchPlaceholder="Search models..."
                emptyMessage="No model profiles found"
                loading={modelProfilesQuery.isLoading}
              />
            </div>
          </div>
          <Button type="button" size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={() => void submitMessage()} disabled={isSending || !input.trim()} aria-label="Send message">
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
