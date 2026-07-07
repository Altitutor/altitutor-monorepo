import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@altitutor/shared'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import { callUcatAiJson, UcatAiJsonParseError } from '@/features/ucat/shared/server/ucat-ai-client'

const jsonSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonSchema),
    z.record(jsonSchema),
  ])
)

const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  toolCallId: z.string().optional(),
  toolName: z.string().optional(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    summary: z.string(),
    input: z.record(jsonSchema).default({}),
    requiresConfirmation: z.boolean().optional(),
  })).optional(),
  toolResult: z.object({
    toolCallId: z.string(),
    ok: z.boolean(),
    message: z.string(),
    output: jsonSchema.optional(),
  }).optional(),
})

const requestSchema = z.object({
  contextType: z.enum(['question_stem', 'learning_module_lesson', 'generated_review']),
  scope: z.enum(['current_stem', 'lesson', 'review_current_stem', 'review_batch']),
  scopeLabel: z.string(),
  modelProfileId: z.string().nullable().optional(),
  selectedImage: z
    .object({
      label: z.string(),
      src: z.string().nullable().optional(),
      fileId: z.string().nullable().optional(),
      location: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  snapshot: jsonSchema,
  messages: z.array(chatMessageSchema).min(1),
})

const toolCallSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  summary: z.string(),
  input: z.record(jsonSchema).default({}),
  requiresConfirmation: z.boolean().optional(),
})

const responseSchema = z.object({
  status: z.enum(['tool_calls', 'final']).optional(),
  message: z.string(),
  toolCalls: z.array(toolCallSchema).default([]),
})

const TOOL_CATALOG: Record<string, string[]> = {
  question_stem: [
    'updateStemText({text})',
    'updateStemProperties({sectionId?, categoryId?, isPrivate?, approvalStatus?, tutorSourceNote?})',
    'updateQuestionText({questionIndex, text})',
    'insertQuestion({questionText, answerExplanation?, options:[{answerText,isAnswer}], tagIds?, difficulty?, timeBurdenSeconds?})',
    'updateQuestionProperties({questionIndex, difficulty?, timeBurdenSeconds?, tagIds?})',
    'updateQuestionTags({questionIndex, tagIds})',
    'insertAnswerOption({questionIndex, answerText, isAnswer?})',
    'updateAnswerOption({questionIndex, optionIndex, answerText?, answerExplanation?, isAnswer?})',
    'markCorrectAnswer({questionIndex, optionIndex})',
    'updateAnswerExplanation({questionIndex, text})',
    'deleteQuestion({questionIndex}) confirmation required',
    'deleteAnswerOption({questionIndex, optionIndex}) confirmation required',
    'replaceImageFromPrompt({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'insertImage({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'replaceVisualSpec({target:"stem"|"question"|"explanation"|"answerOption", visualType, spec, altText?, title?, mode?:"replace"|"append"})',
  ],
  learning_module_lesson: [
    'updateLessonMetadata({title?, description?, sectionId?, isPrivate?})',
    'insertTextBlock({index, text})',
    'updateTextBlock({blockId, text})',
    'insertQuestionStemBlock({index, questionStemId})',
    'insertQuestionBlock({index, questionId})',
    'insertBestMatchingQuestionStem({query, index?})',
    'insertBestMatchingQuestion({query, index?})',
    'insertSkillTrainerBlock({index, skillTrainerId})',
    'moveBlock({blockId, toIndex})',
    'updateBlockGate({blockId, requireCompletionBeforeNext})',
    'deleteBlock({blockId}) confirmation required',
    'replaceImageFromPrompt({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'insertImage({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'replaceVisualSpec({target:"stem"|"question"|"explanation"|"answerOption", visualType, spec, altText?, title?, mode?:"replace"|"append"})',
  ],
  generated_review: [
    'updateReviewCandidateStemText({stemId, text})',
    'updateReviewCandidateQuestionText({stemId, questionIndex, text})',
    'updateReviewCandidateQuestionProperties({stemId, questionIndex, difficulty?, timeBurdenSeconds?, tagIds?})',
    'updateReviewCandidateAnswerOption({stemId, questionIndex, optionIndex, answerText?, answerExplanation?, isAnswer?})',
    'updateReviewCandidateExplanation({stemId, questionIndex, text})',
    'deleteReviewCandidate({stemId}) confirmation required',
    'replaceImageFromPrompt({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'insertImage({target:"stem"|"question"|"explanation"|"answerOption", prompt, alt?})',
    'replaceVisualSpec({target:"stem"|"question"|"explanation"|"answerOption", visualType, spec, altText?, title?, mode?:"replace"|"append"})',
  ],
}

function buildSystemPrompt(contextType: keyof typeof TOOL_CATALOG) {
  return `You are Altitutor's UCAT authoring agent. Return only JSON.

You edit the tutor's local unsaved draft through a tool loop. The tutor's Save/Import action is the persistence boundary.
For each step, either call one or more tools, or return a final response. After calling tools, stop and wait for tool results in the next step.
Prefer exactly one mutating tool call per step. This is mandatory for broad authoring requests such as writing a full learning module, generating several blocks, adding practice questions, or editing multiple explanations.
For broad authoring requests, work incrementally: start with metadata or the first content block, wait for the tool result, inspect the updated snapshot, then continue with the next block or edit.
Use the tool results to decide the next action. If a tool failed or was denied, adapt instead of repeating the same failed call.
Show concise execution trace in your message. Do not reveal hidden reasoning.
Only deletion tools require confirmation. Set requiresConfirmation=true for deleteQuestion, deleteAnswerOption, deleteBlock, and deleteReviewCandidate. Do not require confirmation for rewrites, property changes, visibility/approval draft changes, image generation, or additions.
Call at most one deletion tool in a step so the tutor can approve it clearly.
For requests about an existing visual, diagram, image, labels overlapping, lines overlapping, unreadable map, Venn diagram, chart, or "regenerate the image", call a visual/image tool. Do not answer by rewriting the content as prose or a markdown table.
Prefer replaceVisualSpec for examinable UCAT charts, Venn/set diagrams, maps, labels, numbers, or relationships, because deterministic visuals keep the data auditable. Use target:"stem" unless the tutor clearly refers to a question, explanation, or answer option visual.
If the tutor explicitly asks for a photographic/raster/generated image rather than an examinable deterministic diagram, use insertImage/replaceImageFromPrompt instead.
Use simple text fields for prose; the client converts text into rich editor documents.
If prose needs a table, a normal markdown pipe table is acceptable; the client converts it into a rich editor table.
When adding multiple visuals to the same target, set mode:"append" after the first visual.
For question stem editing, the snapshot may include currentQuestionIndex/currentQuestionNumber plus availableTags, availableCategories, and availableSections. Use those IDs directly when tagging or categorising. If the tutor says "this question" or does not specify a question number, target currentQuestionIndex.
For learning modules, use insertBestMatchingQuestionStem or insertBestMatchingQuestion when the tutor asks you to find an appropriate existing question from the database and add it to the lesson. Use insertQuestionStemBlock/insertQuestionBlock only when you already know the exact ID.
Do not invent catalog IDs. If an ID is needed and not present in the snapshot, ask the tutor for it instead of calling a tool.

Available tools for this context:
${TOOL_CATALOG[contextType].map((tool) => `- ${tool}`).join('\n')}

Response JSON shape:
{
  "status": "tool_calls" | "final",
  "message": "short user-readable summary / execution trace",
  "toolCalls": [
    {
      "name": "toolName",
      "summary": "what will change",
      "input": {},
      "requiresConfirmation": false
    }
  ]
}
}`
}

function encodeStreamEvent(type: string, data: unknown) {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
}

function formatAgentError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  if (/\bterminated\b/iu.test(message)) {
    return 'The model terminated before returning a valid tool plan. Try a smaller request, choose a stronger model, or split the task into lesson outline first and block generation second.'
  }
  if (/invalid JSON/iu.test(message)) {
    return 'The model returned an invalid structured tool plan after automatic repair retries. Try sending the request again or make it slightly more specific.'
  }
  if (/timed out/iu.test(message)) {
    return 'The model took too long to produce a tool plan. Try a smaller request or choose a faster model.'
  }
  return message || 'UCAT authoring agent failed'
}

function buildAgentUserPrompt(
  body: z.infer<typeof requestSchema>,
  lastUserMessage: z.infer<typeof chatMessageSchema>,
  repairContext?: { reason: string; previousContent?: string | null }
) {
  return JSON.stringify({
    currentRequest: lastUserMessage.content,
    scope: body.scope,
    scopeLabel: body.scopeLabel,
    selectedImage: body.selectedImage ?? null,
    recentMessages: body.messages.slice(-14).map((message) => ({
      role: message.role,
      content: message.content,
      toolCalls: message.toolCalls?.map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.name,
        summary: toolCall.summary,
        input: toolCall.input,
        requiresConfirmation: toolCall.requiresConfirmation ?? false,
      })),
      toolResult: message.toolResult ?? null,
      toolCallId: message.toolCallId ?? null,
      toolName: message.toolName ?? null,
    })),
    editorSnapshot: body.snapshot,
    ...(repairContext
      ? {
          repairInstruction: 'Your previous response could not be parsed as the required JSON tool plan. Return only valid JSON matching the Response JSON shape. Do not include markdown, prose outside JSON, comments, or trailing commas.',
          previousPlanError: repairContext.reason,
          previousInvalidResponse: repairContext.previousContent?.slice(0, 2000) ?? null,
        }
      : {}),
  })
}

function isPlanRepairableError(error: unknown): boolean {
  return error instanceof UcatAiJsonParseError || error instanceof z.ZodError
}

async function runAgentStep(body: z.infer<typeof requestSchema>, access: Extract<Awaited<ReturnType<typeof requireUcatTutor>>, { ok: true }>) {
  const lastUserMessage = [...body.messages].reverse().find((message) => message.role === 'user')
  if (!lastUserMessage) throw new Error('No user message provided')

  let parsed: z.infer<typeof responseSchema> | null = null
  let repairContext: { reason: string; previousContent?: string | null } | undefined

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const raw = await callUcatAiJson({
        client: access.userClient as unknown as SupabaseClient<Database>,
        operation: `authoring_agent_${body.contextType}${attempt > 0 ? '_repair' : ''}`,
        modelProfileId: body.modelProfileId ?? null,
        systemPrompt: buildSystemPrompt(body.contextType),
        userPrompt: buildAgentUserPrompt(body, lastUserMessage, repairContext),
        timeoutMs: 90000,
        maxCompletionTokens: body.contextType === 'learning_module_lesson' ? 8000 : 5000,
        metadata: {
          contextType: body.contextType,
          scope: body.scope,
          repairAttempt: attempt,
        },
      })
      parsed = responseSchema.parse(raw.parsed)
      break
    } catch (error) {
      if (!isPlanRepairableError(error) || attempt >= 2) throw error
      repairContext = {
        reason: error instanceof Error ? error.message : 'Invalid structured tool plan',
        previousContent: error instanceof UcatAiJsonParseError ? error.content : null,
      }
    }
  }

  if (!parsed) throw new Error('AI authoring failed before returning a structured tool plan')
  const toolCalls = parsed.toolCalls.slice(0, 1).map((toolCall, index) => ({
    id: toolCall.id ?? `tool-${Date.now()}-${index}`,
    ...toolCall,
  }))
  const droppedToolCount = Math.max(0, parsed.toolCalls.length - toolCalls.length)
  return {
    status: toolCalls.length > 0 ? 'tool_calls' as const : parsed.status ?? 'final' as const,
    message: droppedToolCount > 0
      ? `${parsed.message}\n\nStarting with the first edit; I’ll continue after seeing the tool result.`
      : parsed.message,
    toolCalls,
  }
}

export async function POST(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  try {
    const body = requestSchema.parse(await request.json())
    if (request.headers.get('x-ucat-agent-stream') === '1') {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            controller.enqueue(encodeStreamEvent('status', { message: 'Reading the current draft...' }))
            controller.enqueue(encodeStreamEvent('status', { message: 'Planning the next edit step...' }))
            const response = await runAgentStep(body, access)
            controller.enqueue(encodeStreamEvent('step', { response }))
          } catch (error) {
            controller.enqueue(encodeStreamEvent('error', {
              message: formatAgentError(error),
            }))
          } finally {
            controller.close()
          }
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      })
    }

    return NextResponse.json(await runAgentStep(body, access))
  } catch (error) {
    console.error('UCAT authoring agent failed:', error)
    return NextResponse.json(
      { error: formatAgentError(error) },
      { status: 400 },
    )
  }
}
