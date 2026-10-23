import { render, screen } from "@testing-library/react";
import type { Tables } from "@altitutor/shared";
import { CalendarView } from "../CalendarView";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const biology = {
  id: "bio",
  short_name: "Biology",
  long_name: "Biology",
} as Tables<"subjects">;
const classes = [
  {
    id: "a",
    short_name: "Extension A",
    long_name: "Extension class A",
    day_of_week: 1,
    start_time: "16:00:00",
    end_time: "17:00:00",
    room: "A",
  },
  {
    id: "b",
    short_name: "Foundation B",
    long_name: "Foundation class B",
    day_of_week: 2,
    start_time: "16:00:00",
    end_time: "17:00:00",
    room: "B",
  },
] as Tables<"classes">[];

it("uses shared class-name search, day selection and display properties without extra calendar controls", () => {
  const props = {
    classes,
    classSubjects: { a: biology, b: biology },
    onClassClick: jest.fn(),
    showFilters: false,
    searchValue: "EXTENSION",
    visibleProperties: ["subject"],
  };
  const { rerender } = render(<CalendarView {...props} />);
  expect(screen.getByText("Biology")).toBeVisible();
  expect(screen.getByText("Monday")).toBeVisible();
  expect(screen.queryByText("Tuesday")).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  expect(screen.queryByText("Show admin shifts")).not.toBeInTheDocument();
  rerender(<CalendarView {...props} selectedDays={[2]} />);
  expect(screen.queryByText("Biology")).not.toBeInTheDocument();
  rerender(<CalendarView {...props} visibleProperties={[]} />);
  expect(screen.queryByText("Biology")).not.toBeInTheDocument();
});
