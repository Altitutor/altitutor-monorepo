import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkflowEmail } from "../WorkflowEmail";
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
it("prepares canonical domain text in one shared draft with explicit Student context", async () => {
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "fa250000-0000-4000-8000-000000000099",
  });
  const commands: Array<Record<string, unknown>> = [];
  const student = {
    id: "fa250000-0000-4000-8000-000000000001",
    first_name: "Student",
    email: "student@example.test",
  };
  const draft = {
    id: "workflow-draft",
    threadId: "workflow-thread",
    folderId: "drafts",
    subject: "",
    bodyText: "",
    sender: "admin@development.altitutor.com",
    to: [],
    cc: [],
    bcc: [],
    draft: true,
    read: true,
    changeKey: "one",
  };
  global.fetch = jest.fn(async (input, init) => {
    if (String(input).includes("/commands")) {
      const command = JSON.parse(String(init?.body));
      commands.push(command);
      return {
        ok: true,
        json: async () =>
          command.action === "draft"
            ? { state: "draft", message: draft }
            : command.action === "save"
              ? {
                  state: "saved",
                  message: { ...draft, ...command.content, changeKey: "two" },
                }
              : {},
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({
        threads: [],
        hasMore: false,
        folders: [],
        staff: [],
        currentStaffId: "fixture-admin",
        configured: true,
        mailboxAddress: "admin@development.altitutor.com",
        mailboxEnvironment: "development",
        signature: "Admin Staff",
        templates: [],
        sync: [],
      }),
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
      <WorkflowEmail
        student={student}
        parents={[]}
        subject="Absence confirmation"
        buildBody={async (name) =>
          `Hi ${name}, the billing credit is being processed.`
        }
      />
    </QueryClientProvider>,
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Prepare email" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Prepare email" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Email body" })).toHaveValue(
      "Hi Student, the billing credit is being processed.",
    ),
  );
  expect(screen.getByRole("textbox", { name: "Email recipients" })).toHaveValue(
    "student@example.test",
  );
  expect(
    screen.getByText("Altitutor Admin · admin@development.altitutor.com"),
  ).toBeInTheDocument();
  expect(commands.filter((command) => command.action === "draft")).toHaveLength(
    1,
  );
  expect(commands).toContainEqual({
    action: "link",
    threadId: "workflow-thread",
    recordType: "student",
    recordId: student.id,
  });
  expect(commands.some((command) => command.action === "send")).toBe(false);
});
