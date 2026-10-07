import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ClassDetailPage from "../page";

const mockDelete = jest.fn().mockResolvedValue(undefined);
let mockImpact: {
  data?: {
    canDelete: boolean;
    futureSessionCount: number;
    historicalSessionCount: number;
    protectedFutureSessionCount: number;
  };
  isLoading: boolean;
  isError: boolean;
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@altitutor/ui", () => {
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  return {
    ...actual,
    SegmentedTabPanel: ({
      children,
    }: {
      children: import("react").ReactNode;
    }) => <>{children}</>,
    SegmentedTabPanelContent: ({
      children,
    }: {
      children: import("react").ReactNode;
    }) => <>{children}</>,
    useToast: () => ({ toast: jest.fn() }),
  };
});
jest.mock("@/shared/components/PrimaryEntityBreadcrumb", () => ({
  PrimaryEntityBreadcrumb: () => null,
}));
jest.mock("@/features/issues", () => ({ IssuePill: () => null }));
jest.mock("@/shared/components", () => ({ AdminLoadingSkeleton: () => null }));
jest.mock("@/features/classes/api", () => ({ classesApi: {} }));
jest.mock("@/features/classes/hooks/useClassActions", () => ({
  useClassActions: (props: { onDelete: () => void }) => props,
}));
jest.mock("@/shared/components/ActionsMenu", () => ({
  ActionsMenu: ({ onDelete }: { onDelete: () => void }) => (
    <button onClick={onDelete}>Delete class</button>
  ),
}));
jest.mock("@/features/classes/hooks/useClassesQuery", () => ({
  useClassDetails: () => ({
    data: {
      class: { id: "class", level: "Test Class", session_type: "CLASS" },
      students: [],
      staff: [],
    },
    isLoading: false,
  }),
  useClassDeleteImpact: () => mockImpact,
  useDeleteClass: () => ({ mutateAsync: mockDelete }),
}));
jest.mock("@/features/subjects", () => ({ useSubjects: () => ({ data: [] }) }));
jest.mock("@/features/students/hooks/useStudentsQuery", () => ({
  useStudents: () => ({ data: [] }),
}));
jest.mock("@/features/staff/hooks/useStaffQuery", () => ({
  useStaff: () => ({ data: [] }),
}));
jest.mock("@/features/classes/components/modal/tabs/ClassInfoTab", () => ({
  ClassInfoTab: () => null,
}));
jest.mock("@/features/classes/components/modal/tabs/ClassPeopleTab", () => ({
  ClassPeopleTab: () => null,
}));
jest.mock("@/features/classes/components/modal/tabs/ClassSessionsTab", () => ({
  ClassSessionsTab: () => null,
}));
jest.mock("@/features/activity/components/tabs/ClassActivityTab", () => ({
  ClassActivityTab: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockImpact = {
    data: {
      canDelete: true,
      futureSessionCount: 4,
      historicalSessionCount: 0,
      protectedFutureSessionCount: 0,
    },
    isLoading: false,
    isError: false,
  };
});

function openAndConfirmName() {
  render(<ClassDetailPage params={{ id: "class" }} />);
  fireEvent.click(screen.getByText("Delete class"));
  fireEvent.change(screen.getByPlaceholderText("Test Class"), {
    target: { value: "Test Class" },
  });
}

it("previews pristine future sessions and deletes an eligible class after confirmation", async () => {
  openAndConfirmName();
  expect(screen.getByText(/4 pristine future Sessions/)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("class"));
});

it("blocks deletion and explains deactivation when historical or protected sessions exist", () => {
  mockImpact.data = {
    canDelete: false,
    futureSessionCount: 4,
    historicalSessionCount: 3,
    protectedFutureSessionCount: 2,
  };
  openAndConfirmName();
  expect(
    screen.getByText(/3 historical and 2 protected future Sessions/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/make it inactive through Edit Class instead/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Delete" }),
  ).toBeDisabled();
  expect(mockDelete).not.toHaveBeenCalled();
});

it.each(["loading", "error"] as const)(
  "blocks deletion while impact lookup is %s",
  (state) => {
    mockImpact = {
      data: undefined,
      isLoading: state === "loading",
      isError: state === "error",
    };
    openAndConfirmName();
    expect(
      screen.getByRole("button", { name: "Delete" }),
    ).toBeDisabled();
    expect(
      screen.getByText(
        state === "loading"
          ? /Checking deletion impact/
          : /Unable to check deletion impact/,
      ),
    ).toBeInTheDocument();
  },
);
