import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@altitutor/ui";
import { useMailbox } from "../../api/client";
import { EmailComposer } from "../EmailComposer";
import type { EmailMessage, MailboxData } from "../../types";
const draft: EmailMessage = {
  id: "shared-draft",
  threadId: "mail-thread",
  folderId: "drafts",
  subject: "Class change",
  bodyText: "Original work",
  sender: "admin@altitutor.com",
  to: ["parent@example.test"],
  cc: [],
  bcc: [],
  draft: true,
  read: true,
  removed: false,
  changeKey: "version-one",
};
const mailbox: MailboxData = {
  threads: [],
  hasMore: false,
  folders: [],
  staff: [],
  currentStaffId: "fixture-admin",
  configured: true,
  mailboxAddress: "admin@altitutor.com",
  mailboxEnvironment: "production",
  signature: "Admin Staff",
  templates: [],
  sync: [],
};
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({ openEntity: jest.fn() }),
}));
// jsdom has no layout; ProseMirror scrolls a DOM Range after a focused edit.
beforeAll(() => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  Element.prototype.scrollIntoView = jest.fn();
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => [],
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      width: 0,
      height: 0,
    }),
  });
});
// Drive the real browser-upload transport through the same fake HTTP boundary.
const xhrRequests = new WeakMap<
  XMLHttpRequest,
  { method: string; url: string }
>();
let openUpload: jest.SpyInstance;
let sendUpload: jest.SpyInstance;
beforeAll(() => {
  openUpload = jest
    .spyOn(XMLHttpRequest.prototype, "open")
    .mockImplementation(function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
    ) {
      xhrRequests.set(this, { method, url: String(url) });
    });
  sendUpload = jest
    .spyOn(XMLHttpRequest.prototype, "send")
    .mockImplementation(function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const request = xhrRequests.get(this)!;
      this.upload.dispatchEvent(
        new ProgressEvent("progress", {
          lengthComputable: true,
          loaded: 50,
          total: 100,
        }),
      );
      void global.fetch!(request.url, {
        method: request.method,
        body: body as BodyInit,
      })
        .then(async (response) => {
          Object.defineProperty(this, "status", {
            configurable: true,
            value: response.status || (response.ok ? 200 : 400),
          });
          Object.defineProperty(this, "responseText", {
            configurable: true,
            value: JSON.stringify(await response.json()),
          });
          this.onload?.call(this, new ProgressEvent("load"));
        })
        .catch(() => this.onerror?.call(this, new ProgressEvent("error")));
    });
});
afterAll(() => {
  openUpload.mockRestore();
  sendUpload.mockRestore();
});
const originalFetch = global.fetch;
async function editBody(text: string) {
  const editor = screen.getByRole("textbox", { name: "Email body" });
  await act(async () => {
    editor.blur();
    editor.innerHTML = `<p>${text}</p>`;
    fireEvent.input(editor);
    await jest.advanceTimersByTimeAsync(1);
  });
  await act(async () => {
    editor.focus();
  });
  return editor;
}

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});
it("autosaves to the shared draft and prevents another submission while the send outcome is uncertain", async () => {
  jest.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  const commands: Array<{
    action: string;
    content?: { bodyText: string; expectedChangeKey: string };
    changeKey?: string;
  }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return { ok: true, json: async () => ({ person: null }) } as Response;
    const command = JSON.parse(String(init?.body)) as (typeof commands)[number];
    commands.push(command);
    return {
      ok: true,
      json: async () =>
        command.action === "save"
          ? {
              state: "saved",
              message: {
                ...draft,
                bodyText: command.content?.bodyText,
                changeKey: "version-two",
              },
            }
          : { state: "uncertain" },
    } as Response;
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <TooltipProvider>
        <EmailComposer
          draft={draft}
          mailbox={mailbox}
          inline
          onClose={() => {}}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await editBody("My saved reply");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1100);
  });
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "Saved to Microsoft · shared draft" }),
    ).toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() =>
    expect(screen.getByText(/Send outcome is unresolved/)).toBeInTheDocument(),
  );
  expect(screen.getByRole("textbox", { name: "Email body" })).toHaveTextContent(
    "My saved reply",
  );
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(commands.filter((command) => command.action === "send")).toEqual([
    {
      action: "send",
      undoDelaySeconds: 10,
      id: "shared-draft",
      changeKey: "version-two",
      commandId: "fa250000-0000-4000-8000-000000000099",
    },
  ]);
  expect(
    commands.find((command) => command.action === "save")?.content,
  ).toMatchObject({
    bodyText: "My saved reply",
    expectedChangeKey: "version-one",
  });
});
it.each(["keep", "microsoft"] as const)(
  "recovers a cached Outlook draft conflict using the %s choice",
  async (choice) => {
    jest.useFakeTimers();
    localStorage.clear();
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: () => "fa250000-0000-4000-8000-000000000099",
    });
    const saved: Array<{ expectedChangeKey: string; bodyText: string }> = [];
    const outlook = {
      ...draft,
      bodyText: "Work saved in Outlook",
      changeKey: "outlook-version",
    };
    global.fetch = jest.fn(async (_input, init) => {
      if (!init?.body)
        return { ok: true, json: async () => ({ person: null }) } as Response;
      const command = JSON.parse(String(init?.body));
      saved.push(command.content);
      return {
        ok: true,
        json: async () =>
          saved.length === 1
            ? { state: "conflict", message: outlook }
            : {
                state: "saved",
                message: {
                  ...outlook,
                  bodyText: command.content.bodyText,
                  changeKey: "portal-version",
                },
              },
      } as Response;
    });
    render(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          })
        }
      >
        <TooltipProvider>
          <EmailComposer
            draft={draft}
            mailbox={mailbox}
            inline
            onClose={() => {}}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await editBody("My preserved portal work");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1100);
    });
    expect(
      screen.getByRole("textbox", { name: "Email body" }),
    ).toHaveTextContent("My preserved portal work");
    expect(
      screen.getByRole("button", { name: "Use Microsoft version" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Keep my text and save against this version",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name:
          choice === "keep"
            ? "Keep my text and save against this version"
            : "Use Microsoft version",
      }),
    );
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1100);
    });
    if (choice === "keep")
      expect(saved[1]).toMatchObject({
        expectedChangeKey: "outlook-version",
        bodyText: "My preserved portal work",
      });
    else {
      expect(
        screen.getByRole("textbox", { name: "Email body" }),
      ).toHaveTextContent("Work saved in Outlook");
      expect(saved).toHaveLength(1);
    }
  },
);

it("keeps typing and submission responsive after an autosave without refreshing unrelated mailbox data", async () => {
  jest.useFakeTimers();
  localStorage.clear();
  let reads = 0;
  global.fetch = jest.fn(async (input, init) => {
    if (String(input).includes("/people"))
      return { ok: true, json: async () => ({ person: null }) } as Response;
    if (!init?.body) {
      reads++;
      // A slow mailbox refresh must not hold the editor's save/send state.
      if (reads > 1) return new Promise<Response>(() => {});
      return { ok: true, json: async () => mailbox } as Response;
    }
    const command = JSON.parse(String(init.body));
    return {
      ok: true,
      json: async () => ({
        state: "saved",
        message: {
          ...draft,
          bodyText: command.content.bodyText,
          changeKey: "version-two",
        },
      }),
    } as Response;
  });
  function Workspace() {
    useMailbox();
    return (
      <TooltipProvider>
        <EmailComposer
          draft={draft}
          mailbox={mailbox}
          inline
          onClose={() => {}}
        />
      </TooltipProvider>
    );
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <Workspace />
    </QueryClientProvider>,
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(10);
  });
  const editor = screen.getByRole("textbox", { name: "Email body" });
  await act(async () => {
    editor.focus();
  });
  await editBody("First sentence");
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1100);
  });
  await waitFor(() =>
    expect(
      screen.getByRole("status", { name: "Saved to Microsoft · shared draft" }),
    ).toBeInTheDocument(),
  );
  expect(reads).toBe(1);
  expect(editor).toHaveFocus();
  expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  await editBody("First sentence, still typing");
  expect(editor).toHaveTextContent("First sentence, still typing");
});

it("dismisses only after Microsoft accepts the saved draft", async () => {
  localStorage.clear();
  const closed = jest.fn();
  let accept: (value: Response) => void = () => {};
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return { ok: true, json: async () => ({ person: null }) } as Response;
    return new Promise<Response>((resolve) => {
      accept = resolve;
    });
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <EmailComposer
          draft={draft}
          mailbox={mailbox}
          inline
          onClose={closed}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  expect(closed).not.toHaveBeenCalled();
  await waitFor(() =>
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/email/commands",
      expect.objectContaining({ method: "POST" }),
    ),
  );
  await act(async () => {
    accept({
      ok: true,
      json: async () => ({ state: "submitted" }),
    } as Response);
  });
  await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
});

it("opens an editable local draft while Microsoft prepares it and saves only its provider ID", async () => {
  jest.useFakeTimers();
  localStorage.clear();
  let ready: (value: { message: EmailMessage }) => void = () => {};
  const preparation = new Promise<{ message: EmailMessage }>((resolve) => {
    ready = resolve;
  });
  const commands: Array<{ id: string; content: { bodyText: string } }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return { ok: true, json: async () => ({ person: null }) } as Response;
    const command = JSON.parse(String(init.body));
    commands.push(command);
    return {
      ok: true,
      json: async () => ({
        state: "saved",
        message: {
          ...draft,
          bodyText: command.content.bodyText,
          changeKey: "two",
        },
      }),
    } as Response;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <EmailComposer
          draft={{ ...draft, id: "local:instant" }}
          draftReady={preparation}
          mailbox={mailbox}
          inline
          onClose={() => {}}
        />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  await editBody("Written before Microsoft responds");
  expect(screen.getByRole("textbox", { name: "Email body" })).toHaveTextContent(
    "Written before Microsoft responds",
  );
  expect(commands).toHaveLength(0);
  await act(async () => {
    ready({ message: draft });
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1100);
  });
  await waitFor(() => expect(commands).toHaveLength(1));
  expect(commands[0]).toMatchObject({
    id: draft.id,
    content: { bodyText: "Written before Microsoft responds" },
  });
});

it.each(["Close draft", "Delete draft"])(
  "offers an explicit %s choice when closing",
  async (choice) => {
    localStorage.clear();
    const closed = jest.fn(),
      commands: string[] = [];
    global.fetch = jest.fn(async (_input, init) => {
      if (!init?.body)
        return { ok: true, json: async () => ({ person: null }) } as Response;
      commands.push(JSON.parse(String(init.body)).action);
      return {
        ok: true,
        json: async () => ({ state: "discarded" }),
      } as Response;
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <TooltipProvider>
          <EmailComposer
            draft={draft}
            mailbox={mailbox}
            inline
            onClose={closed}
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(closed).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Keep this draft?" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Close draft" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: "Delete draft" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: choice }));
    await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
    expect(commands).toEqual(
      choice === "Delete draft" ? ["discard"] : ["releaseDraft"],
    );
  },
);

it("selects or clears a send time without submitting, then uses regular Send to schedule", async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 31, 12));
  localStorage.clear();
  const closed = jest.fn();
  const commands: Array<{ action: string; scheduledAt?: string }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return {
        ok: true,
        json: async () => ({ person: null, ambiguous: false }),
      } as Response;
    commands.push(JSON.parse(String(init.body)));
    return { ok: true, json: async () => ({ state: "scheduled" }) } as Response;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailComposer draft={draft} mailbox={mailbox} onClose={closed} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Schedule send" }));
  fireEvent.click(screen.getByRole("button", { name: /Select date/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Type a date" }), {
    target: { value: "2 November 2026" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Type a date" }), {
    key: "Enter",
  });
  expect(commands).toEqual([]);
  expect(
    screen.getByRole("button", { name: /Scheduled time:/ }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  expect(
    screen.getByRole("button", { name: "Send", hidden: true }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Select date/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Type a date" }), {
    target: { value: "2 November 2026" },
  });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Type a date" }), {
    key: "Enter",
  });
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Schedule email" }));
  await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  expect(commands).toHaveLength(1);
  expect(commands[0]?.action).toBe("schedule");
  const scheduled = new Date(commands[0]!.scheduledAt!);
  expect([
    scheduled.getFullYear(),
    scheduled.getMonth(),
    scheduled.getDate(),
    scheduled.getHours(),
    scheduled.getMinutes(),
  ]).toEqual([2026, 10, 2, 9, 0]);
});

it.each([false, true])(
  "uses provider Reply-To recipients while preserving deliberate recipient edits: %s",
  async (edited) => {
    jest.useFakeTimers();
    localStorage.clear();
    let ready: (value: { message: EmailMessage }) => void = () => {};
    const preparation = new Promise<{ message: EmailMessage }>((resolve) => {
      ready = resolve;
    });
    const saved: Array<{ to: string[]; cc: string[] }> = [];
    global.fetch = jest.fn(async (_input, init) => {
      if (!init?.body)
        return { ok: true, json: async () => ({ person: null }) } as Response;
      const command = JSON.parse(String(init.body));
      saved.push(command.content);
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...draft, ...command.content, changeKey: "two" },
        }),
      } as Response;
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <EmailComposer
          draft={{ ...draft, id: "local:reply" }}
          draftReady={preparation}
          mailbox={mailbox}
          inline
          onClose={() => {}}
        />
      </QueryClientProvider>,
    );
    await editBody("Reply prepared before the provider responds");
    if (edited) {
      fireEvent.click(
        screen.getByRole("button", { name: "Remove parent@example.test" }),
      );
      fireEvent.change(
        screen.getByRole("textbox", { name: "Email recipients" }),
        { target: { value: "chosen@example.test" } },
      );
      fireEvent.keyDown(
        screen.getByRole("textbox", { name: "Email recipients" }),
        { key: "Enter" },
      );
    }
    await act(async () => {
      ready({
        message: {
          ...draft,
          to: ["reply-to@example.test"],
          cc: ["colleague@example.test"],
        },
      });
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1100);
    });
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved[0]).toMatchObject({
      to: [edited ? "chosen@example.test" : "reply-to@example.test"],
      cc: ["colleague@example.test"],
    });
  },
);

it("blocks remote image nodes before mounting a provider draft in the rich editor", () => {
  localStorage.clear();
  global.fetch = jest.fn(
    async () =>
      ({ ok: true, json: async () => ({ person: null }) }) as Response,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailComposer
        draft={{
          ...draft,
          bodyHtml:
            '<p>Quoted work<img src="https://tracker.example.test/pixel"></p>',
        }}
        mailbox={mailbox}
        inline
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByRole("textbox", { name: "Email body" })).toHaveTextContent(
    "Quoted work",
  );
  expect(
    screen.getByRole("textbox", { name: "Email body" }).querySelector("img"),
  ).toBeNull();
});

it("requires an incomplete recipient to be committed or corrected before Send", () => {
  localStorage.clear();
  global.fetch = jest.fn(
    async () =>
      ({ ok: true, json: async () => ({ person: null }) }) as Response,
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailComposer
        draft={draft}
        mailbox={mailbox}
        inline
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Email recipients" }), {
    target: { value: "unfinished-address" },
  });
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Email recipients" }), {
    key: "Enter",
  });
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.change(screen.getByRole("textbox", { name: "Email recipients" }), {
    target: { value: "" },
  });
  expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
});

it("attaches files dropped into the draft using the same guarded Microsoft upload as the picker", async () => {
  localStorage.clear();
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  const uploaded: File[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (String(input).includes("/attachments") && init?.method === "POST") {
      uploaded.push((init.body as FormData).get("file") as File);
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: {
            ...draft,
            hasAttachments: true,
            changeKey: `attachment-${uploaded.length}`,
          },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ person: null }) } as Response;
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <EmailComposer draft={draft} mailbox={mailbox} onClose={() => {}} />
    </QueryClientProvider>,
  );
  const file = new File(["Class timetable"], "timetable.txt", {
    type: "text/plain",
  });
  fireEvent.drop(screen.getByRole("region", { name: "Shared email draft" }), {
    dataTransfer: { files: [file], types: ["Files"] },
  });
  await waitFor(() =>
    expect(uploaded.map((item) => item.name)).toEqual(["timetable.txt"]),
  );
});

it("closes after queueing and lets Undo cancel before the ten-second send window", async () => {
  jest.useFakeTimers();
  localStorage.clear();
  const { toast } = await import("sonner");
  const feedback = jest.spyOn(toast, "success");
  const commands: Array<{ action: string; undoDelaySeconds?: number }> = [];
  const closed = jest.fn();
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return { ok: true, json: async () => ({ person: null }) } as Response;
    const command = JSON.parse(String(init.body));
    commands.push(command);
    return {
      ok: true,
      json: async () =>
        command.action === "send"
          ? {
              state: "queued",
              commandId: "fa250000-0000-4000-8000-000000000099",
              scheduledAt: new Date(Date.now() + 10_000).toISOString(),
            }
          : { state: "cancelled" },
    } as Response;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <TooltipProvider>
        <EmailComposer draft={draft} mailbox={mailbox} onClose={closed} />
      </TooltipProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(closed).toHaveBeenCalledTimes(1));
  expect(commands[0]).toMatchObject({ action: "send", undoDelaySeconds: 10 });
  const options = feedback.mock.calls.find(
    ([label]) => label === "Sending in 10 seconds",
  )?.[1];
  expect(options?.action).toMatchObject({ label: "Undo" });
  await act(async () => {
    const action = options?.action;
    if (action && typeof action === "object" && "onClick" in action)
      action.onClick({} as React.MouseEvent<HTMLButtonElement>);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(11_000);
  });
  expect(commands.map((command) => command.action)).toEqual([
    "send",
    "cancelSchedule",
  ]);
  feedback.mockRestore();
});
it("serializes files dropped onto the editor and can undo one upload using the latest draft version", async () => {
  localStorage.clear();
  const { toast } = await import("sonner");
  const feedback = jest.spyOn(toast, "success");
  const uploaded: Array<{ name: string; version: string }> = [];
  const removals: unknown[] = [];
  let finishFirst: (response: Response) => void = () => {};
  global.fetch = jest.fn(async (input, init) => {
    if (
      String(input).includes("/attachments") &&
      init?.body instanceof FormData
    ) {
      const file = init.body.get("file") as File;
      uploaded.push({
        name: file.name,
        version: String(init.body.get("changeKey")),
      });
      if (uploaded.length === 1)
        return new Promise<Response>((resolve) => {
          finishFirst = resolve;
        });
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...draft, changeKey: "upload-two" },
          attachment: { id: "file-two" },
        }),
      } as Response;
    }
    if (init?.body) {
      removals.push(JSON.parse(String(init.body)));
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...draft, hasAttachments: true, changeKey: "removed-one" },
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({ person: null }) } as Response;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailComposer draft={draft} mailbox={mailbox} onClose={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.drop(screen.getByRole("textbox", { name: "Email body" }), {
    dataTransfer: {
      types: ["Files"],
      files: [new File(["one"], "one.txt"), new File(["two"], "two.txt")],
    },
  });
  await waitFor(() => expect(uploaded).toHaveLength(1));
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  await act(async () =>
    finishFirst({
      ok: true,
      json: async () => ({
        state: "saved",
        message: { ...draft, changeKey: "upload-one" },
        attachment: { id: "file-one" },
      }),
    } as Response),
  );
  await waitFor(() => expect(uploaded).toHaveLength(2));
  expect(uploaded).toEqual([
    { name: "one.txt", version: "version-one" },
    { name: "two.txt", version: "upload-one" },
  ]);
  await waitFor(() => expect(screen.getByText("two.txt")).toBeInTheDocument());
  const action = feedback.mock.calls.find(
    ([label]) => label === "Attached one.txt",
  )?.[1]?.action;
  await act(async () => {
    if (action && typeof action === "object" && "onClick" in action)
      action.onClick({} as React.MouseEvent<HTMLButtonElement>);
  });
  await waitFor(() =>
    expect(removals).toEqual([
      expect.objectContaining({
        action: "removeAttachment",
        attachmentId: "file-one",
        changeKey: "upload-two",
      }),
    ]),
  );
  await waitFor(() =>
    expect(screen.queryByText("one.txt")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("two.txt")).toBeInTheDocument();
  feedback.mockRestore();
});

it("preserves a reply-all subject when inserting a template so Exchange can keep the conversation", async () => {
  localStorage.clear();
  global.fetch = jest.fn(
    async () =>
      ({ ok: true, json: async () => ({ person: null }) }) as Response,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailComposer
        draft={{
          ...draft,
          subject: "RE: Class change",
          draftMode: "replyAll",
          replyToMessageId: "original",
        }}
        mailbox={{
          ...mailbox,
          templates: [
            {
              id: "template-one",
              name: "Lesson follow-up",
              subject: "Lesson follow-up",
              body_text: "Thank you for your email.",
            },
          ],
        }}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Insert email template" }),
  );
  fireEvent.click(
    await screen.findByRole("option", { name: "Lesson follow-up" }),
  );
  expect(screen.getByRole("textbox", { name: "Email subject" })).toHaveValue(
    "RE: Class change",
  );
  expect(screen.getByRole("textbox", { name: "Email body" })).toHaveTextContent(
    "Thank you for your email.",
  );
});

it("sends once with Command+Enter from the subject field using the normal undo window", async () => {
  localStorage.clear();
  const commands: Array<{ action: string; undoDelaySeconds?: number }> = [];
  global.fetch = jest.fn(async (_input, init) => {
    if (!init?.body)
      return { ok: true, json: async () => ({ person: null }) } as Response;
    commands.push(JSON.parse(String(init.body)));
    return {
      ok: true,
      json: async () => ({
        state: "queued",
        scheduledAt: new Date(Date.now() + 10_000).toISOString(),
        commandId: "fa250000-0000-4000-8000-000000000099",
      }),
    } as Response;
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EmailComposer draft={draft} mailbox={mailbox} onClose={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Email subject" }), {
    key: "Enter",
    metaKey: true,
  });
  await waitFor(() =>
    expect(
      commands.filter((command) => command.action === "send"),
    ).toHaveLength(1),
  );
  expect(commands[0]).toMatchObject({ action: "send", undoDelaySeconds: 10 });
});

it("reloads draft attachments and lets staff preview and remove an existing file", async () => {
  localStorage.clear();
  const commands: Array<{ action: string; attachmentId?: string }> = [];
  global.fetch = jest.fn(async (input, init) => {
    if (init?.body) {
      commands.push(JSON.parse(String(init.body)));
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...draft, hasAttachments: false, changeKey: "removed" },
        }),
      } as Response;
    }
    return {
      ok: true,
      json: async () =>
        String(input).includes("/attachments")
          ? [
              {
                id: "attachment-one",
                name: "timetable.pdf",
                contentType: "application/pdf",
                size: 1200,
                type: "#microsoft.graph.fileAttachment",
              },
            ]
          : { person: null },
    } as Response;
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailComposer
        draft={{ ...draft, hasAttachments: true }}
        mailbox={mailbox}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("button", { name: "Preview timetable.pdf" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove timetable.pdf" }));
  await waitFor(() =>
    expect(commands).toContainEqual(
      expect.objectContaining({
        action: "removeAttachment",
        attachmentId: "attachment-one",
      }),
    ),
  );
});

it("shows chunk upload progress and blocks send until Microsoft confirms the complete file", async () => {
  localStorage.clear();
  const chunks: Array<{ offset: string; size: number }> = [];
  let finishChunk: (response: Response) => void = () => {};
  const commands: string[] = [];
  global.fetch = jest.fn(async (input, init) => {
    if (
      String(input).endsWith("/attachments/upload") &&
      init?.method === "POST"
    )
      return {
        ok: true,
        json: async () => ({
          ticket: "opaque-fixture-ticket",
          chunkSize: 1_966_080,
        }),
      } as Response;
    if (init?.body instanceof FormData) {
      chunks.push({
        offset: String(init.body.get("offset")),
        size: (init.body.get("file") as File).size,
      });
      if (chunks.length === 1)
        return new Promise<Response>((resolve) => {
          finishChunk = resolve;
        });
      return {
        ok: true,
        json: async () => ({
          state: "saved",
          message: { ...draft, hasAttachments: true, changeKey: "uploaded" },
          attachment: { id: "large-file" },
        }),
      } as Response;
    }
    if (init?.body) commands.push(String(init.body));
    return { ok: true, json: async () => ({ person: null }) } as Response;
  });
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailComposer draft={draft} mailbox={mailbox} onClose={() => {}} />
    </QueryClientProvider>,
  );
  fireEvent.drop(screen.getByRole("region", { name: "Shared email draft" }), {
    dataTransfer: {
      types: ["Files"],
      files: [new File([new Uint8Array(3_000_000)], "large.bin")],
    },
  });
  await waitFor(() => expect(chunks).toHaveLength(1));
  expect(
    screen.getByRole("progressbar", { name: "Uploading large.bin" }),
  ).toHaveAttribute("value", "32");
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Email subject" }), {
    key: "Enter",
    metaKey: true,
  });
  expect(commands).toHaveLength(0);
  await act(async () =>
    finishChunk({
      ok: true,
      json: async () => ({ state: "uploading", nextOffset: 1_966_080 }),
    } as Response),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Preview large.bin" }),
    ).toBeInTheDocument(),
  );
  expect(chunks).toEqual([
    { offset: "0", size: 1_966_080 },
    { offset: "1966080", size: 1_033_920 },
  ]);
  expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  expect(commands).toHaveLength(0);
});
