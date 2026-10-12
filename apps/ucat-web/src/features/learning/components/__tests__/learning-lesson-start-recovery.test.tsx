import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LearningLessonPage } from "../learning-lesson-page";

const openQuotaLimit = jest.fn();
const setActivityComplete = jest.fn();
const reportActivityCompletion = jest.fn();
// Jest's classic JSX transform needs React for the production module's JSX.
const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
beforeAll(() =>
  Object.defineProperty(globalThis, "React", {
    value: React,
    configurable: true,
  }),
);
afterAll(() => {
  if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
  else Reflect.deleteProperty(globalThis, "React");
});

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: jest.fn(),
}));
jest.mock("@/features/layout", () => ({
  UcatPageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("@/features/ucat-access/context/upsell-dialog-context", () => ({
  useQuotaLimitDialog: () => ({ openQuotaLimit }),
}));
jest.mock("@/features/study-plan/context/study-plan-companion-context", () => ({
  useStudyPlanCompanion: () => ({
    setActivityComplete,
    reportActivityCompletion,
  }),
}));
jest.mock("@/shared/hooks/use-ucat-stagger-motion", () => ({
  useUcatStaggerMotion: () => ({}),
}));
jest.mock("@/features/learning/components/learn-question-block", () => ({
  LearnQuestionBlock: () => null,
}));
jest.mock("@/features/learning/components/learn-skill-trainer-block", () => ({
  LearnSkillTrainerBlock: () => null,
}));
jest.mock("@/features/learning/components/learning-text-block", () => ({
  LearningTextBlock: () => null,
}));
jest.mock(
  "@/features/learning/components/learning-lesson-contents-sidebar",
  () => ({ LearningLessonContentsSidebar: () => null }),
);
jest.mock("@/features/learning/components/learning-lesson-pager", () => ({
  LearningLessonPager: () => null,
}));
jest.mock(
  "@/features/learning/components/learning-lesson-progress-dialogs",
  () => ({
    LearningMarkLessonCompleteDialog: () => null,
    LearningMarkLessonIncompleteDialog: () => null,
  }),
);
jest.mock(
  "@/features/learning/components/learning-lesson-page-skeleton",
  () => ({ LearningLessonPageSkeleton: () => <div>Loading lesson</div> }),
);
jest.mock("@/features/learning/hooks/use-learning", () => ({
  ...jest.requireActual("@/features/learning/hooks/use-learning"),
  useLearningModules: () => ({ data: [] }),
  useUpdateBlockProgress: () => ({ mutate: jest.fn() }),
  useMarkBlockComplete: () => ({ mutate: jest.fn() }),
  useMarkLessonComplete: () => ({ mutate: jest.fn() }),
  useResetLessonProgress: () => ({ mutate: jest.fn() }),
}));
jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    ...props
  }: React.PropsWithChildren<{
    asChild?: boolean;
    variant?: string;
    onClick?: () => void;
  }>) => (asChild ? children : <button {...props}>{children}</button>),
}));
jest.mock("motion/react", () => ({
  motion: {
    div: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  },
}));

function response(status: number, body: unknown) {
  const value = {
    status,
    ok: status < 400,
    json: async () => body,
    clone: () => value,
  };
  return value;
}
function mount(retry: number | false = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry, retryDelay: 0, gcTime: 0 } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <LearningLessonPage
        lessonId="lesson-1"
        sectionNumber={1}
        studyPlanTaskId="task-1"
      />
    </QueryClientProvider>,
  );
  return () => {
    view.unmount();
    client.clear();
  };
}
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe("rendered lesson launch recovery through the real API and hook", () => {
  it("replaces a rejected task's skeleton with the current-plan link and does not retry", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        response(500, { error: "invalid_study_plan_learning_task" }),
      );
    global.fetch = fetchMock;
    const cleanup = mount(1);
    try {
      const link = await screen.findByRole("link", {
        name: "Back to Study plan",
      });
      expect(link).toHaveAttribute("href", "/study-plan");
      expect(screen.queryByText("Loading lesson")).not.toBeInTheDocument();
      expect(screen.queryByText("Lesson not found.")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/ucat/learning-modules/lesson-1/start",
        expect.objectContaining({
          body: JSON.stringify({ studyPlanTaskId: "task-1" }),
        }),
      );
      expect(
        screen.queryByRole("button", { name: "Try again" }),
      ).not.toBeInTheDocument();
    } finally {
      cleanup();
    }
  });
  it("keeps quota errors reachable and opens the existing quota dialog", async () => {
    const quota = {
      code: "QUOTA_EXCEEDED",
      area: "learn",
      used: 3,
      limit: 3,
      period: "week",
    };
    global.fetch = jest.fn().mockResolvedValue(response(403, quota));
    const cleanup = mount();
    try {
      expect(
        await screen.findByText("Learning module limit reached."),
      ).toBeVisible();
      expect(openQuotaLimit).toHaveBeenCalledWith(quota, expect.any(Object));
      expect(screen.queryByText("Loading lesson")).not.toBeInTheDocument();
    } finally {
      cleanup();
    }
  });
  it("preserves the configured transient retry and offers an explicit retry that can load the lesson", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(response(503, { error: "upstream unavailable" }));
    global.fetch = fetchMock;
    const cleanup = mount(1);
    try {
      const retry = await screen.findByRole("button", { name: "Try again" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      fetchMock
        .mockResolvedValueOnce(response(200, { created: false }))
        .mockResolvedValueOnce(
          response(200, {
            module: {
              id: "lesson-1",
              title: "Completed lesson",
              display_mode: "stepped",
              completion_percent: 100,
              completed_at: "2026-10-11T01:22:19Z",
            },
            blocks: [],
          }),
        );
      fireEvent.click(retry);
      expect(
        await screen.findByRole("heading", { name: "Completed lesson" }),
      ).toBeVisible();
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(fetchMock.mock.calls[3][0]).toBe(
        "/api/ucat/learning-modules/lesson-1",
      );
      await waitFor(() =>
        expect(screen.queryByText("Loading lesson")).not.toBeInTheDocument(),
      );
    } finally {
      cleanup();
    }
  });
});
