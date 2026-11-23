'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Button, Label, Textarea } from '@altitutor/ui';

const transport = new DefaultChatTransport({
  api: '/api/admin-ai/chat',
  prepareSendMessagesRequest({ id, messages }) {
    return { body: { threadId: id, message: messages.at(-1) } };
  },
});

function renderChatText(text: string) {
  return text.split(/(\[[^\]\n]+\]\(\/[a-z][a-z0-9/_-]*\))/gi).map((part, index) => {
    const link = /^\[([^\]\n]+)\]\((\/[a-z][a-z0-9/_-]*)\)$/i.exec(part);
    return link ? <Link key={index} className="underline" href={link[2]}>{link[1]}</Link> : part;
  });
}

export function AdminChat({
  id,
  initialMessages,
  threads,
}: {
  id: string;
  initialMessages: UIMessage[];
  threads: { id: string; title: string }[];
}) {
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(initialMessages.length > 0);
  const { messages, sendMessage, setMessages, status, stop, error } = useChat({
    id,
    messages: initialMessages,
    transport,
    onFinish: ({ message, messages: conversation, isAbort, isError, isDisconnect }) => {
      const hasAnswer = message.parts.some((part) => part.type === 'text' && part.text.trim());
      if (isAbort || isError || isDisconnect || !hasAnswer) {
        const lastUser = conversation.findLastIndex(({ role }) => role === 'user');
        if (lastUser >= 0) {
          const original = conversation[lastUser].parts.find((part) => part.type === 'text');
          if (original) setDraft(original.text);
          setMessages(conversation.slice(0, lastUser));
        }
        if (!isAbort && !isError && !isDisconnect) {
          setNotice('The assistant finished without an answer. Try a narrower question.');
        }
        return;
      }
      window.history.replaceState(null, '', `/ai-chat?thread=${id}`);
      setSaved(true);
    },
  });
  const busy = status === 'submitted' || status === 'streaming';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setNotice('');
    void sendMessage({ text });
  }

  return (
    <section aria-labelledby="staff-chat-heading" className="mx-auto max-w-3xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="staff-chat-heading" className="text-2xl font-semibold">Staff chat</h1>
        <div className="flex items-center gap-3">
          <Link className="text-sm underline" href="/settings/ai">AI settings</Link>
          {saved && <Link className="text-sm underline" href="/ai-chat">New chat</Link>}
        </div>
      </header>
      {threads.length > 0 && (
        <details className="rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Recent chats</summary>
          <ul className="mt-2 space-y-2 text-sm">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link aria-current={thread.id === id ? 'page' : undefined} href={`/ai-chat?thread=${thread.id}`} className="underline">
                  {thread.title}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
      {messages.length === 0 && <p className="text-muted-foreground">Ask a question about Altitutor records or staff procedures.</p>}
      <div className="space-y-4" aria-label="Conversation">
        {messages.map((message) => (
          <article key={message.id} className="space-y-2 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">{message.role === 'user' ? 'You' : 'Assistant'}</h2>
            {message.parts.map((part, index) => {
              if (part.type === 'text') return <p key={index} className="whitespace-pre-wrap break-words">{message.role === 'assistant' ? renderChatText(part.text) : part.text}</p>;
              if ('toolCallId' in part && 'state' in part) {
                const state = part.state;
                const label = state === 'output-available' ? 'Altitutor data retrieved' : state === 'output-error' ? 'Altitutor lookup failed' : 'Checking Altitutor data…';
                return <p key={part.toolCallId} className="text-sm text-muted-foreground">{label}</p>;
              }
              return null;
            })}
          </article>
        ))}
      </div>
      {busy && <p role="status" className="text-sm text-muted-foreground">Working on your request…</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error.message}</p>}
      <form onSubmit={submit} className="space-y-2">
        <Label htmlFor="staff-chat-message">Message</Label>
        <Textarea id="staff-chat-message" name="message" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={busy} maxLength={4000} rows={3} />
        {busy
          ? <Button type="button" variant="outline" onClick={() => void stop()}>Stop</Button>
          : <Button type="submit" disabled={!draft.trim()}>Send</Button>}
      </form>
    </section>
  );
}
