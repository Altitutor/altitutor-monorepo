/** @jest-environment node */
import { MockLanguageModelV4 } from 'ai/test';
import { POST } from '../route';
import { getAdminAiClient, getChatProfiles, getChatSettings } from '@/features/admin-ai/server/settings';
import { getChatThread, saveChatTurn } from '@/features/admin-ai/server/threads';

const mockResponses = jest.fn();
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => ({ responses: mockResponses }),
}));
jest.mock('server-only', () => ({}));
jest.mock('@/features/admin-ai/server/settings', () => ({
  ...jest.requireActual('@/features/admin-ai/server/settings'),
  getAdminAiClient: jest.fn(),
  getChatProfiles: jest.fn(),
  getChatSettings: jest.fn(),
}));
jest.mock('@/features/admin-ai/server/threads', () => ({
  ...jest.requireActual('@/features/admin-ai/server/threads'),
  getChatThread: jest.fn(),
  saveChatTurn: jest.fn(),
}));

const threadId = 'd81484c0-1e47-4d5a-8ebc-613ec776626d';
const profileId = 'ae15634f-6bc4-48ac-8c72-4a5f7859f4d9';
const message = {
  id: 'staff-message',
  role: 'user',
  parts: [{ type: 'text', text: 'What reporting data is available?' }],
} as const;

function turnRequest() {
  return new Request('http://localhost/api/admin-ai/chat', {
    method: 'POST',
    body: JSON.stringify({ threadId, message }),
  });
}

const usage = {
  inputTokens: { total: 50, noCache: 50, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 10, text: 10, reasoning: 0 },
};

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

it('rejects callers before resolving models or attempting a tool call', async () => {
  jest.mocked(getAdminAiClient).mockResolvedValue(null);
  expect((await POST(turnRequest())).status).toBe(403);
  expect(getChatProfiles).not.toHaveBeenCalled();
  expect(mockResponses).not.toHaveBeenCalled();
});

it('runs an Admin MCP read between model steps, streams the answer, and saves only the text', async () => {
  jest.replaceProperty(process, 'env', { ...process.env, ADMIN_AI_OPENAI_API_KEY: 'synthetic-test-key' });
  const rpc = jest.fn().mockResolvedValue({ data: true, error: null });
  jest.mocked(getAdminAiClient).mockResolvedValue({ rpc } as unknown as NonNullable<Awaited<ReturnType<typeof getAdminAiClient>>>);
  jest.mocked(getChatSettings).mockResolvedValue({
    model_profile_id: profileId,
    system_prompt: 'Use the reporting catalog.',
  });
  jest.mocked(getChatProfiles).mockResolvedValue([{
    id: profileId, name: 'Codex', model: 'gpt-5.3-codex', temperature: 0.4, max_completion_tokens: 1024,
    provider: {
      name: 'OpenAI', base_url: 'https://api.openai.com/v1', secret_env_var_name: 'OPENAI_API_KEY',
      provider_kind: 'chat_completions', is_enabled: true,
    },
  }]);
  jest.mocked(getChatThread).mockResolvedValue(null);
  const model = new MockLanguageModelV4({
    doStream: [
      {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: 'tool-call', toolName: 'discover_admin_data', toolCallId: 'catalog',
              input: '{"search":"enquiries"}',
            });
            controller.enqueue({ type: 'finish', usage, finishReason: { unified: 'tool-calls', raw: undefined } });
            controller.close();
          },
        }),
      },
      {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-start', id: 'text' });
            controller.enqueue({ type: 'text-delta', id: 'text', delta: 'Enquiry data is available.' });
            controller.enqueue({ type: 'text-end', id: 'text' });
            controller.enqueue({ type: 'finish', usage, finishReason: { unified: 'stop', raw: undefined } });
            controller.close();
          },
        }),
      },
    ],
  });
  mockResponses.mockReturnValue(model);

  const response = await POST(turnRequest());
  expect(response.status).toBe(200);
  const stream = await response.text();
  expect(stream).toContain('tool-output-available');
  expect(stream).toContain('Enquiry data is available.');
  expect(rpc).toHaveBeenCalledWith('is_adminstaff_active');
  expect(mockResponses).toHaveBeenCalledWith('gpt-5.3-codex');
  expect(model.doStreamCalls).toHaveLength(2);
  expect(model.doStreamCalls[0].tools?.map((tool) => tool.name)).not.toContain('change_admin_issue');
  expect(saveChatTurn).toHaveBeenCalledWith(expect.anything(), threadId, [
    message,
    expect.objectContaining({ parts: [{ type: 'text', text: 'Enquiry data is available.' }] }),
  ], null);
});
