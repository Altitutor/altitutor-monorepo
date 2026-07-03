import type { Json } from '@altitutor/shared'

export type UcatAuthoringAgentContextType =
  | 'question_stem'
  | 'learning_module_lesson'
  | 'generated_review'

export type UcatAuthoringAgentScope =
  | 'current_stem'
  | 'lesson'
  | 'review_current_stem'
  | 'review_batch'

export type UcatAuthoringChatMessage = {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: UcatAuthoringToolCall[]
  toolCallId?: string
  toolName?: string
  toolResult?: UcatAuthoringToolResult
}

export type UcatAuthoringToolCall = {
  id: string
  name: string
  summary: string
  input: Record<string, Json | undefined>
  requiresConfirmation?: boolean
}

export type UcatAuthoringToolResult = {
  toolCallId: string
  ok: boolean
  message: string
  output?: Json
}

export type UcatAuthoringAgentRequest = {
  contextType: UcatAuthoringAgentContextType
  scope: UcatAuthoringAgentScope
  scopeLabel: string
  modelProfileId?: string | null
  selectedImage?: {
    label: string
    src?: string | null
    fileId?: string | null
    location?: string | null
  } | null
  snapshot: Json
  messages: UcatAuthoringChatMessage[]
}

export type UcatAuthoringAgentResponse = {
  status: 'tool_calls' | 'final'
  message: string
  toolCalls: UcatAuthoringToolCall[]
}

export type UcatAuthoringAgentStreamEvent =
  | { type: 'status'; message: string }
  | { type: 'step'; response: UcatAuthoringAgentResponse }
  | { type: 'error'; message: string }

export type UcatAuthoringToolExecutor = (
  toolCall: UcatAuthoringToolCall,
) => UcatAuthoringToolResult | Promise<UcatAuthoringToolResult>
