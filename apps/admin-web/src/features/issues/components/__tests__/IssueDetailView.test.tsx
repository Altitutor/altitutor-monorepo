import { randomUUID } from "crypto";
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IssueDetailView } from "../IssueDetailView";
import { issuesApi } from "../../api/issues";
import { issueKeys } from "../../api/queryKeys";
import type { IssueWithTags } from "../../types";
import {
  patchWorkItem,
  readWorkItem,
  type WorkItemSnapshot,
} from "@/features/work-item-editing/api";

jest.mock("../../api/issues", () => ({ issuesApi: { get: jest.fn() } }));
jest.mock("@/features/work-item-editing/api", () => ({
  readWorkItem: jest.fn(),
  patchWorkItem: jest.fn(),
  deleteWorkItem: jest.fn(),
}));
jest.mock("@/shared/hooks/useNotes", () => ({
  useNotes: () => ({ data: [] }),
}));
jest.mock("@/shared/hooks/usePaneNavigation", () => ({
  usePaneNavigation: () => ({ router: { push: jest.fn() } }),
}));
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({ openEntity: jest.fn() }),
}));
jest.mock("@/shared/hooks/useMentionSuggestions", () => ({
  useMentionSuggestions: () => undefined,
}));
jest.mock("@/shared/hooks/useSlashCommandSuggestions", () => ({
  useSlashCommandSuggestions: () => [],
}));
jest.mock("@/features/tasks/components/LinkedTasksSection", () => ({
  LinkedTasksSection: () => null,
}));
jest.mock("../IssueActivityTab", () => ({ IssueActivityTab: () => null }));
jest.mock("@/shared/components/EntityResizablePanels", () => ({
  EntityResizablePanels: ({ main, sidebar }: { main: ReactNode; sidebar: ReactNode }) => (
    <div>{main}{sidebar}</div>
  ),
}));
jest.mock("@/shared/components/ActionsMenu", () => ({
  ActionsMenu: () => null,
}));
jest.mock("@/features/rich-text-templates/components/SaveAsTemplateDialog", () => ({
  SaveAsTemplateDialog: () => null,
}));

const issue: IssueWithTags = {
  id: "53370000-0000-4000-8000-000000000001",
  name: "Existing issue",
  description: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Existing description" }] }],
  },
  status: "open",
  priority: 0,
  due_date: null,
  admin_revision: 1,
  created_at: "2026-11-05T00:00:00Z",
  updated_at: "2026-11-05T00:00:00Z",
  created_by: null,
  deleted_at: null,
  deleted_by: null,
  resolved_at: null,
  resolved_by: null,
  search_vector: null,
  tags: [],
};
const getIssue = jest.mocked(issuesApi.get);
const read = jest.mocked(readWorkItem);
const patch = jest.mocked(patchWorkItem);
const missing = () => Object.assign(new Error("Work item not found"), { code: "P0002" });
const snapshot = (value: IssueWithTags = issue): WorkItemSnapshot => ({
  record: {
    id: value.id,
    name: value.name,
    description: value.description,
    status: value.status,
    priority: value.priority,
    due_date: value.due_date,
    admin_revision: value.admin_revision,
  },
  user_id: "user",
  conflicts: [],
});

beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", { value: randomUUID, configurable: true });
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  getIssue.mockResolvedValue(issue);
  read.mockResolvedValue(snapshot());
  patch.mockRejectedValue(missing());
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onClose = jest.fn();
  const view = (issueId: string) => (
    <QueryClientProvider client={client}>
      <IssueDetailView issueId={issueId} onClose={onClose} variant="dialog" />
    </QueryClientProvider>
  );
  const rendered = render(view(issue.id));
  return { ...rendered, client, view };
}

it("keeps unsaved issue text visible when its detail query becomes null after not-found", async () => {
  const { client } = setup();
  const title = await screen.findByPlaceholderText("Issue title");
  await waitFor(() => expect(title).toHaveValue("Existing issue"));
  getIssue.mockResolvedValue(null);
  fireEvent.change(title, { target: { value: "Unsaved local issue title" } });
  await screen.findByText(/This record is no longer available/);
  await waitFor(() => expect(client.getQueryData(issueKeys.detail(issue.id))).toBeNull());
  expect(screen.getByPlaceholderText("Issue title")).toHaveValue("Unsaved local issue title");
  expect(screen.getByPlaceholderText("Issue title")).toBeDisabled();
  expect(screen.getByText("Existing description")).toBeVisible();
  expect(screen.queryByText("Issue not found")).not.toBeInTheDocument();
  expect(sessionStorage.getItem(`work-autosave:user:issue:${issue.id}`)).toContain("Unsaved local issue title");
});


it("does not show a previous issue while another record loads or is missing", async () => {
  const { client, rerender, view } = setup();
  await screen.findByDisplayValue("Existing issue");
  const nextIssue: IssueWithTags = {
    ...issue,
    id: "53370000-0000-4000-8000-000000000002",
    name: "Second issue",
    description: null,
  };
  let completeRead!: (value: WorkItemSnapshot) => void;
  getIssue.mockResolvedValue(nextIssue);
  read.mockImplementationOnce(() => new Promise((resolve) => { completeRead = resolve; }));
  act(() => client.setQueryData(issueKeys.detail(nextIssue.id), nextIssue));
  rerender(view(nextIssue.id));
  expect(screen.queryByDisplayValue("Existing issue")).not.toBeInTheDocument();
  expect(screen.queryByText("Existing description")).not.toBeInTheDocument();
  expect(screen.getByText("Loading issue data...")).toBeVisible();
  await act(async () => completeRead(snapshot(nextIssue)));
  await screen.findByDisplayValue("Second issue");

  getIssue.mockResolvedValue(null);
  read.mockRejectedValueOnce(missing());
  rerender(view("53370000-0000-4000-8000-000000000003"));
  await screen.findByText("Issue not found");
  expect(screen.queryByDisplayValue("Second issue")).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Issue title")).not.toBeInTheDocument();
});
