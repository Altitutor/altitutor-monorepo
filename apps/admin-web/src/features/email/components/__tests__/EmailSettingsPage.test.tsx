import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailSettingsPage } from "../EmailSettingsPage";
const removeTemplate = jest.fn(async () => ({ error: null }));
const upsert = jest.fn(async () => ({ error: null }));
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: () => ({ upsert, delete: () => ({ eq: removeTemplate }) }),
  }),
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  upsert.mockClear();
});
it("lists templates with row actions and edits through the shared dialog", async () => {
  global.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({
          threads: [],
          hasMore: false,
          folders: [],
          staff: [],
          currentStaffId: "admin",
          configured: false,
          mailboxAddress: "admin@development.altitutor.com",
          mailboxEnvironment: "development",
          signature: "A signature",
          templates: [
            {
              id: "one",
              name: "Welcome",
              subject: "Welcome subject",
              body_text: "Welcome body",
            },
          ],
          sync: [],
        }),
      }) as Response,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailSettingsPage />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("table")).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "Template name" }),
  ).not.toBeInTheDocument();
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Actions for Welcome" }),
    { key: "Enter", code: "Enter" },
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
  expect(
    await screen.findByRole("dialog", { name: "Edit email template" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Template name" }), {
    target: { value: "Updated welcome" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() =>
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "one", name: "Updated welcome" }),
    ),
  );
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  fireEvent.click(screen.getByRole("tab", { name: "My signature" }));
  expect(
    screen.getByRole("button", { name: "Actions for My signature" }),
  ).toBeInTheDocument();
});

beforeAll(() => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
});
it("keeps remaining templates reachable after deleting the final row on page two", async () => {
  let templates = Array.from({ length: 21 }, (_, index) => ({
    id: String(index + 1),
    name: `Template ${String(index + 1).padStart(2, "0")}`,
    subject: "",
    body_text: "Body",
  }));
  removeTemplate.mockImplementation(async () => {
    templates = templates.slice(0, 20);
    return { error: null };
  });
  global.fetch = jest.fn(
    async () =>
      ({
        ok: true,
        json: async () => ({
          threads: [],
          hasMore: false,
          folders: [],
          staff: [],
          currentStaffId: "admin",
          configured: false,
          mailboxAddress: "admin@development.altitutor.com",
          mailboxEnvironment: "development",
          signature: "",
          templates,
          sync: [],
        }),
      }) as Response,
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailSettingsPage />
    </QueryClientProvider>,
  );
  await screen.findByRole("table");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Actions for Template 21" }),
    { key: "Enter", code: "Enter" },
  );
  fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete template" }));
  expect(
    await screen.findByRole("button", { name: "Actions for Template 01" }),
  ).toBeInTheDocument();
  expect(screen.queryByText("No templates found.")).not.toBeInTheDocument();
});
