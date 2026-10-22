import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Tables } from "@altitutor/shared";
import { SessionsCalendarView } from "../SessionsCalendarView";
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
it("shows a colored subject for a session without a class and omits day/week controls", async () => {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SessionsCalendarView
        initialDate="2026-10-22"
        source={{
          sessions: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              long_name: "Private lesson",
              type: "DRAFTING",
              subject_id: "bio",
              class_id: null,
              start_at: "2026-10-22T06:30:00Z",
              end_at: "2026-10-22T07:30:00Z",
            } as Tables<"sessions">,
          ],
          classesById: {},
          subjectsById: {
            bio: {
              id: "bio",
              long_name: "Biology",
              color: "#336699",
            } as Tables<"subjects">,
          },
          sessionStudents: {},
          sessionStaff: {},
          tutorLogs: {},
        }}
      />
    </QueryClientProvider>,
  );
  expect(screen.queryByText("1 day")).not.toBeInTheDocument();
  expect(screen.queryByText("1 week")).not.toBeInTheDocument();
  await userEvent.hover(screen.getByLabelText("Private lesson details"));
  const details = within(
    await screen.findByRole("dialog", { name: "Private lesson details" }),
  );
  expect(details.getByText("Biology")).toHaveStyle({
    backgroundColor: "#336699",
  });
  client.clear();
});
