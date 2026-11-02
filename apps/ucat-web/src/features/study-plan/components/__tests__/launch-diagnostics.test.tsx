import React from "react";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  cleanup,
  renderHook,
  act,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type {
  StudyPlanTask,
  StudyPlanResponse,
} from "@/features/study-plan/model/types";
import { learningApi } from "@/features/learning/api/learning-api";
import { UpsellDialogProvider } from "@/features/ucat-access/context/upsell-dialog-context";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
const mockPush = jest.fn();
(globalThis as typeof globalThis & { React: typeof React }).React = React;
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
      <ul {...props}>{children}</ul>
    ),
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{children}</li>
    ),
  },
  useReducedMotion: () => false,
}));
const task: StudyPlanTask = {
  id: "ed000000-0000-4000-8000-000000000003",
  scheduledDate: "2026-10-19",
  sortOrder: 0,
  taskType: "practice",
  title: "Practice action",
  description: "Practice",
  rationale: "",
  estimatedMinutes: 20,
  targetUnits: 10,
  sectionId: "section",
  questionStemCategoryId: null,
  questionTagId: null,
  learningModuleId: null,
  questionSetId: null,
  mockId: null,
  skillTrainerId: null,
  launchPath: "/practice",
  launchConfig: {
    kind: "practice",
    section: "verbal_reasoning",
    ucatSectionId: "section",
    questionCount: 10,
  },
  sourceTaskId: null,
  status: "planned",
  completedUnits: 0,
  startedAt: null,
  completedAt: null,
  skippedAt: null,
  matchedActivityType: null,
  matchedActivityId: null,
};
let currentTask = task;
let otherTasks: StudyPlanTask[] = [];
const lessonStarts: Record<string, unknown>[] = [];
let serverStatus: StudyPlanTask["status"];
let starts: Array<{
  filtersSnapshot: { studyPlanTaskId: string };
  observedStatus: string;
  studyPlanLaunch?: unknown;
}>;
const originalFetch = global.fetch;
const now = Date.parse("2026-10-21T12:50:00Z");
let rejectedStarts: number;
function response(data: unknown, ok = true) {
  return { ok, json: async () => data } as Response;
}
function snapshot(): StudyPlanResponse {
  const item = { ...currentTask, status: serverStatus };
  return {
    profile: null,
    generation: null,
    tasks: [item, ...otherTasks],
    nextSteps: [],
    today: "2026-10-21",
    todayTasks: [item],
    completion: { completed: 0, scheduledThroughToday: 1, percent: 0 },
  };
}
function App({ label }: { label: string }) {
  const plan = useStudyPlan();
  return (
    <section aria-label={label}>
      {plan.data ? (
        <StudyPlanTaskList tasks={plan.data.tasks} today={plan.data.today} />
      ) : null}
    </section>
  );
}
function mount(label: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <UpsellDialogProvider>
        <App label={label} />
      </UpsellDialogProvider>
    </QueryClientProvider>,
  );
  return client;
}
beforeEach(() => {
  jest.spyOn(Date, "now").mockReturnValue(now);
  window.history.replaceState({}, "", "/study-plan");
  sessionStorage.clear();
  currentTask = task;
  otherTasks = [];
  lessonStarts.length = 0;
  mockPush.mockClear();
  serverStatus = "planned";
  starts = [];
  rejectedStarts = 0;
  global.fetch = jest.fn(async (url, options) => {
    if (String(url) === "/api/ucat/study-plan") return response(snapshot());
    if (String(url).includes("/study-plan/tasks/")) {
      const body = JSON.parse(String(options?.body));
      serverStatus = body.action === "skip" ? "skipped" : "planned";
      return response({});
    }
    if (String(url).includes("/api/ucat/learning-modules/")) {
      lessonStarts.push(
        JSON.parse(String(options?.body)) as Record<string, unknown>,
      );
      return {
        ...response({ error: "invalid_study_plan_learning_task" }, false),
        status: 500,
        clone() {
          return this;
        },
      };
    }
    if (String(url) === "/api/ucat/practice-sessions") {
      const body = JSON.parse(String(options?.body));
      starts.push({ ...body, observedStatus: serverStatus });
      if (serverStatus === "skipped") {
        rejectedStarts++;
        return response({ error: "invalid_study_plan_task" }, false);
      }
      return response({
        id: "session",
        stems: [],
        questionCount: 0,
        totalMatchingQuestions: 0,
      });
    }
    throw new Error("unexpected URL");
  }) as typeof fetch;
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  sessionStorage.clear();
});
test("fresh skipped task offers Undo skip and cannot launch from its task row", async () => {
  serverStatus = "skipped";
  const client = mount("fresh");
  const row = screen.getByRole("region", { name: "fresh" });
  await within(row).findByRole("button", { name: "Undo skip" });
  expect(within(row).queryByRole("button", { name: "Start" })).toBeNull();
  expect(starts).toHaveLength(0);
  client.clear();
});
test("ordinary Skip updates the same cache before subsequent row action", async () => {
  const client = mount("same view");
  const row = screen.getByRole("region", { name: "same view" });
  fireEvent.click(await within(row).findByRole("button", { name: "Skip" }));
  await within(row).findByRole("button", { name: "Undo skip" });
  expect(serverStatus).toBe("skipped");
  expect(within(row).queryByRole("button", { name: "Start" })).toBeNull();
  expect(starts).toHaveLength(0);
  client.clear();
});
test("independent cached view still submits skipped task after first view skips", async () => {
  const a = mount("view A"),
    b = mount("view B");
  const ra = screen.getByRole("region", { name: "view A" }),
    rb = screen.getByRole("region", { name: "view B" });
  await within(ra).findByRole("button", { name: "Skip" });
  await within(rb).findByRole("button", { name: "Start" });
  fireEvent.click(within(ra).getByRole("button", { name: "Skip" }));
  await within(ra).findByRole("button", { name: "Undo skip" });
  expect(serverStatus).toBe("skipped");
  jest.mocked(Date.now).mockReturnValue(now + 120000);
  fireEvent.click(within(rb).getByRole("button", { name: "Start" }));
  await waitFor(() => expect(starts).toHaveLength(1));
  expect(starts[0].filtersSnapshot.studyPlanTaskId).toBe(task.id);
  expect(starts[0].observedStatus).toBe("skipped");
  expect(rejectedStarts).toBe(1);
  expect(starts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({
      version: 1,
      surface: "study-plan",
      task_status: "planned",
      task_type: "practice",
      plan_age_ms: 120000,
      recent_action: "skip",
      recent_action_age_ms: 120000,
    }),
  );
  expect(starts[0].filtersSnapshot).not.toHaveProperty("studyPlanLaunch");
  await within(rb).findByText(/invalid_study_plan_task/);
  a.clear();
  b.clear();
});

test("lesson navigation carries the launch-time observation into the first real lesson-start request only", async () => {
  currentTask = {
    ...task,
    taskType: "learn",
    title: "Learn task",
    launchConfig: { kind: "learn" },
    launchPath: "/learn/lesson",
  };
  const client = mount("lesson");
  await screen.findByRole("button", { name: "Start" });
  jest.mocked(Date.now).mockReturnValue(now + 2000);
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith(
      "/learn/lesson?studyPlanTaskId=" + task.id,
    ),
  );
  window.history.replaceState(
    {},
    "",
    "/learn/lesson?studyPlanTaskId=" + task.id,
  );
  jest.mocked(Date.now).mockReturnValue(now + 7000);
  await expect(learningApi.startLesson("lesson", task.id)).rejects.toThrow(
    "This Study-plan task is no longer available.",
  );
  expect(lessonStarts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({
      task_type: "learn",
      task_status: "planned",
      surface: "study-plan",
      plan_age_ms: 2000,
      captured_at_ms: now + 2000,
    }),
  );
  await expect(learningApi.startLesson("lesson", task.id)).rejects.toThrow();
  expect(lessonStarts[1]).not.toHaveProperty("studyPlanLaunch");
  client.clear();
});

test("successful undo is recorded and private native-auth return flows omit launch diagnostics", async () => {
  serverStatus = "skipped";
  const client = mount("undo");
  fireEvent.click(await screen.findByRole("button", { name: "Undo skip" }));
  await screen.findByRole("button", { name: "Start" });
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await waitFor(() => expect(starts).toHaveLength(1));
  expect(starts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({
      recent_action: "unskip",
      recent_action_age_ms: 0,
    }),
  );
  expect(JSON.stringify(localStorage)).not.toContain("plan_age_ms");
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled(),
  );
  window.history.replaceState(
    {},
    "",
    "/study-plan?redirect=%252Fmobile-auth%253Fticket%253DPRIVATE",
  );
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await waitFor(() => expect(starts).toHaveLength(2));
  expect(starts[1]).not.toHaveProperty("studyPlanLaunch");
  client.clear();
});
test("blocked diagnostic storage never prevents the ordinary launch or changes its error", async () => {
  const client = mount("blocked");
  await screen.findByRole("button", { name: "Start" });
  jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  serverStatus = "skipped";
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await screen.findByText(/invalid_study_plan_task/);
  expect(starts).toHaveLength(1);
  expect(starts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({ task_status: "planned" }),
  );
  client.clear();
});
test("an expired lesson observation is omitted on an old tab link", async () => {
  currentTask = {
    ...task,
    taskType: "learn",
    launchConfig: { kind: "learn" },
    launchPath: "/learn/lesson",
  };
  const client = mount("expired");
  fireEvent.click(await screen.findByRole("button", { name: "Start" }));
  jest.mocked(Date.now).mockReturnValue(now + 300001);
  await expect(learningApi.startLesson("lesson", task.id)).rejects.toThrow();
  expect(lessonStarts[0]).not.toHaveProperty("studyPlanLaunch");
  client.clear();
});

test("order confirmation diagnoses the actual recommended task and dashboard source", async () => {
  window.history.replaceState({}, "", "/dashboard");
  otherTasks = [
    {
      ...task,
      id: "ed000000-0000-4000-8000-000000000007",
      title: "Earlier task",
      sortOrder: -1,
      status: "partial",
    },
  ];
  const client = mount("recommended");
  await screen.findAllByRole("button", { name: "Start" });
  const selected = screen.getByText(task.title).closest("li");
  expect(selected).not.toBeNull();
  fireEvent.click(within(selected!).getByRole("button", { name: "Start" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Start recommended task" }),
  );
  await waitFor(() => expect(starts).toHaveLength(1));
  expect(starts[0].filtersSnapshot.studyPlanTaskId).toBe(otherTasks[0].id);
  expect(starts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({
      surface: "dashboard",
      launch_action: "start-recommended",
      task_status: "partial",
      plan_age_ms: 0,
    }),
  );
  client.clear();
});

test("ambiguous cache provenance stays unknown instead of borrowing a fresher same-task query", async () => {
  const client = mount("ambiguous");
  await screen.findByRole("button", { name: "Start" });
  const plan = client.getQueryData(["ucat-study-plan"]);
  client.setQueryData(["ucat-study-plan", "dashboard"], plan, {
    updatedAt: now - 5000,
  });
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
  await waitFor(() => expect(starts).toHaveLength(1));
  expect(starts[0].studyPlanLaunch).toEqual(
    expect.objectContaining({ plan_age_ms: null }),
  );
  client.clear();
});

test.each([
  ["/practice?private=DO-NOT-COPY", "practice"],
  ["/learn/private-module?private=DO-NOT-COPY", "learn"],
  ["/progress/practice-sessions/private-id?private=DO-NOT-COPY", "review"],
  ["/skill-trainer/private-trainer/results/private-id", "results"],
])(
  "the companion action hook classifies %s without copying route data",
  async (path, surface) => {
    window.history.replaceState({}, "", path);
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const plan = snapshot();
    serverStatus = "skipped";
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <QueryClientProvider client={client}>
        <UpsellDialogProvider>{children}</UpsellDialogProvider>
      </QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () =>
        useStudyPlanTaskActions(plan.tasks[0], true, plan, "companion-primary"),
      { wrapper },
    );
    await act(async () => {
      await result.current.startTask();
    });
    expect(starts[0].studyPlanLaunch).toEqual(
      expect.objectContaining({
        surface,
        control: "companion-primary",
        plan_age_ms: null,
      }),
    );
    expect(JSON.stringify(starts[0].studyPlanLaunch)).not.toContain(
      "DO-NOT-COPY",
    );
    unmount();
    client.clear();
  },
);
