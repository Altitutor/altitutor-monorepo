import React from "react";
import { ToastProvider } from "@altitutor/ui";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TrialStudentsPage } from "../components/TrialStudentsPage";
import { journey } from "./fixtures";

let mockView = "board";
let mockCurrentStatus: string | null = "TRIAL";
let mockClosed = false;
let mockNextContact: string | null = null;

jest.mock("next/navigation", () => ({
  usePathname: () => "/trial-students",
  useSearchParams: () => new URLSearchParams({ view: mockView }),
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
beforeEach(() => {
  mockView = "board";
  mockCurrentStatus = "TRIAL";
  mockClosed = false;
  mockNextContact = null;
});

beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
const mockStudents = [
  { id: "student-current", status: "TRIAL" },
  { id: "student-discontinued", status: "DISCONTINUED" },
];
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: async (name: string) => ({
      data:
        name === "onboarding_journeys_board"
          ? [
              {
                ...journey("Current student", "student-current"),
                next_contact_at: mockNextContact,
                closed_at: mockClosed ? "2026-10-01T00:00:00Z" : null,
              },
              {
                ...journey("Discontinued student", "student-discontinued"),
                closed_at: mockClosed ? "2026-10-01T00:00:00Z" : null,
              },
              { ...journey("Family enquiry", null), next_contact_at: mockNextContact },
            ]
          : [],
      error: null,
    }),
    from: (table: string) => {
      const query = {
        select: () => query,
        update: (values: { next_contact_at: string | null }) => {
          mockNextContact = values.next_contact_at;
          return query;
        },
        eq: () => query,
        in: () => query,
        order: () => query,
        range: () => query,
        single: async () => ({ data: null, error: null }),
        then: (resolve: (value: unknown) => unknown) =>
          Promise.resolve({
            data:
              table === "students"
                ? mockStudents.map((student) =>
                    student.id === "student-current"
                      ? { ...student, status: mockCurrentStatus }
                      : student,
                  )
                : [],
            error: null,
          }).then(resolve),
      };
      return query;
    },
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  }),
}));

it.each(["TRIAL", "ACTIVE", null])(
  "hides discontinued students while keeping %s students and family enquiries",
  async (status) => {
    mockCurrentStatus = status;
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ToastProvider>
          <TrialStudentsPage />
        </ToastProvider>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("button", { name: /Current student/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Family enquiry/ }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Discontinued student/ }),
      ).not.toBeInTheDocument(),
    );
  },
);

// Linked Student cards now open the Student page; browser coverage lives in
// e2e/student-views-and-boards.spec.ts. Unlinked family enquiries retain dialogs.

it("hides discontinued students from the worklist and search results", async () => {
  mockView = "worklist";
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("cell", { name: "Current student" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("cell", { name: "Discontinued student" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Search$/ }));
  fireEvent.change(await screen.findByPlaceholderText("Search student or subject"), {
    target: { value: "Discontinued" },
  });
  await waitFor(() => expect(
    screen.queryByRole("cell", { name: "Current student" }),
  ).not.toBeInTheDocument());
  expect(
    screen.queryByRole("cell", { name: "Discontinued student" }),
  ).not.toBeInTheDocument();
});

it("excludes discontinued students from filter counts", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: /Current student/ });
  fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.click(await screen.findByRole("button", { name: "Change value for Queue" }));
  expect(
    await screen.findByRole("option", { name: "All open 2" }),
  ).toBeVisible();
});

it("does not offer a student-page link for an unlinked family enquiry", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Family enquiry/ }),
  );
  expect(await screen.findByRole("dialog")).toBeVisible();
  expect(
    within(screen.getByRole("heading", { name: "Family enquiry" })).queryByRole(
      "link",
    ),
  ).not.toBeInTheDocument();
});

it("also hides discontinued students from the completed / closed queue view", async () => {
  mockClosed = true;
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole("button", { name: /Family enquiry/ });
  fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.click(await screen.findByRole("button", { name: "Change value for Queue" }));
  fireEvent.click(
    await screen.findByRole("option", { name: "Completed / closed 1" }),
  );
  expect(
    await screen.findByRole("button", { name: /Current student/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Discontinued student/ }),
  ).not.toBeInTheDocument();
});

it("shows status pills in the family enquiry dialog subheading instead of subjects", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Family enquiry/ }),
  );
  const dialog = await screen.findByRole("dialog");
  const subheading = document.getElementById(
    dialog.getAttribute("aria-describedby")!,
  );
  expect(subheading).toHaveTextContent("Enquiry");
  expect(subheading).toHaveTextContent("Our action");
  expect(subheading).toHaveTextContent("Overdue");
  expect(subheading).not.toHaveTextContent("Maths");
  expect(
    within(dialog).queryByRole("link", { name: "View student" }),
  ).not.toBeInTheDocument();
});

it("sets and clears the next contact date using the shared date picker", async () => {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <ToastProvider>
        <TrialStudentsPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Family enquiry/ }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: /Agreed next contact date/ }),
  );
  const input = await screen.findByPlaceholderText("Type a date...");
  fireEvent.change(input, { target: { value: "2026-10-24" } });
  fireEvent.keyDown(input, { key: "Enter" });
  const selected = await screen.findByRole("button", {
    name: /Agreed next contact date/,
  });
  await waitFor(() => expect(selected).toHaveTextContent("24 Oct 2026"));
  fireEvent.click(selected);
  fireEvent.click(await screen.findByRole("button", { name: "Clear date" }));
  await waitFor(() => expect(selected).toHaveTextContent("Select date"));
});
