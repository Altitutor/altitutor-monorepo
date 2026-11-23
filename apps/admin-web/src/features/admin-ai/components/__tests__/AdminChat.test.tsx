import { act, render, screen } from '@testing-library/react';
import type { ChatInit, UIMessage } from 'ai';
import { AdminChat } from '../AdminChat';

const mockSetMessages = jest.fn();
const mockUseChat = jest.fn().mockReturnValue({ messages: [], setMessages: mockSetMessages, status: 'ready' });
jest.mock('@ai-sdk/react', () => ({ useChat: (options: ChatInit<UIMessage>) => mockUseChat(options) }));
jest.mock("ai", () => ({ DefaultChatTransport: jest.fn() }));

it('keeps a tool-only turn on the unsaved chat and explains how to retry', () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  try {
    render(<AdminChat id="staff-thread" initialMessages={[]} threads={[]} />);
    const { onFinish } = mockUseChat.mock.calls[0][0] as ChatInit<UIMessage>;
    act(() => onFinish?.({
      message: { id: 'assistant', role: 'assistant', parts: [{ type: 'step-start' }] },
      messages: [
        { id: 'staff', role: 'user', parts: [{ type: 'text', text: 'How many enquiries?' }] },
        { id: 'assistant', role: 'assistant', parts: [{ type: 'step-start' }] },
      ],
      isAbort: false,
      isDisconnect: false,
      isError: false,
      finishReason: 'tool-calls',
    }));

    expect(replaceState).not.toHaveBeenCalled();
    expect(mockSetMessages).toHaveBeenCalledWith([]);
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('How many enquiries?');
    expect(screen.getByRole('status')).toHaveTextContent('The assistant finished without an answer.');
  } finally {
    replaceState.mockRestore();
  }
});
