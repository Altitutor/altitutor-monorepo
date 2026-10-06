import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import SubjectDetailPage from "../page";

const mockGet = jest.fn();
const mockUpdate = jest.fn();
const mockReorder = jest.fn().mockResolvedValue(undefined);
const mockInvalidate = jest.fn();
const subject = {
  id: "subject",
  name: "Maths",
  year_level: 12,
  curriculum: "SACE",
  discipline: "MATHEMATICS",
  level: null,
  color: "#123456",
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock("@altitutor/ui", () => {
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  return { ...actual, useToast: () => ({ toast: jest.fn() }) };
});
jest.mock("@/shared/components/PrimaryEntityBreadcrumb", () => ({
  PrimaryEntityBreadcrumb: () => null,
}));
jest.mock("@/shared/components", () => ({ AdminLoadingSkeleton: () => null }));
jest.mock("@/features/subjects/api", () => ({
  subjectsApi: {
    getSubject: () => mockGet(),
    updateSubject: (...args: unknown[]) => mockUpdate(...args),
  },
}));
jest.mock("@/features/subjects/hooks/useSubjectsQuery", () => ({
  subjectsKeys: { all: ["subjects"] },
}));
jest.mock("@/features/subjects/hooks/useSubjectActions", () => ({
  useSubjectActions: (props: { onEdit: () => void }) => props,
}));
jest.mock("@/shared/components/ActionsMenu", () => ({
  ActionsMenu: ({ onEdit }: { onEdit: () => void }) => (
    <button onClick={onEdit}>Edit subject</button>
  ),
}));
jest.mock("@/features/topics/hooks", () => ({
  useTopics: () => ({ data: [], refetch: jest.fn() }),
  useRootTopics: () => ({
    data: [
      { id: "a", name: "Topic A" },
      { id: "b", name: "Topic B" },
    ],
  }),
  useUpdateTopicIndices: () => ({ mutateAsync: mockReorder }),
}));
jest.mock("@/features/topics", () => ({
  TopicsHierarchy: () => null,
  AddTopicModal: () => null,
  DraggableTopicsList: ({
    onReorder,
  }: {
    onReorder: (updates: { id: string; index: number }[]) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onReorder([
          { id: "b", index: 0 },
          { id: "a", index: 1 },
        ])
      }
    >
      Move Topic B first
    </button>
  ),
}));
jest.mock("@/features/subjects/components/SubjectImageField", () => ({
  SubjectImageField: ({ onImageChanged }: { onImageChanged: () => void }) => (
    <button type="button" onClick={onImageChanged}>
      Upload subject image
    </button>
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(subject);
  mockUpdate.mockResolvedValue(subject);
});

async function edit() {
  render(<SubjectDetailPage params={{ id: "subject" }} />);
  fireEvent.click(await screen.findByText("Edit subject"));
}

it("saves root topic ordering together with subject details", async () => {
  await edit();
  fireEvent.click(screen.getByText("Move Topic B first"));
  expect(mockReorder).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Save Changes"));
  await waitFor(() =>
    expect(mockUpdate).toHaveBeenCalledWith(
      "subject",
      expect.objectContaining({ name: "Maths" }),
    ),
  );
  await waitFor(() =>
    expect(mockReorder).toHaveBeenCalledWith([
      { id: "b", index: 0 },
      { id: "a", index: 1 },
    ]),
  );
  await waitFor(() =>
    expect(screen.queryByText("Move Topic B first")).not.toBeInTheDocument(),
  );
});

it("discards pending topic reordering when cancelling edit", async () => {
  await edit();
  fireEvent.click(screen.getByText("Move Topic B first"));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByText("Edit subject"));
  fireEvent.click(screen.getByText("Save Changes"));
  await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  expect(mockReorder).not.toHaveBeenCalled();
});

it("preserves unsaved subject details when its image changes", async () => {
  await edit();
  fireEvent.change(screen.getByLabelText("Subject Name"), {
    target: { value: "New name" },
  });
  fireEvent.click(screen.getByText("Upload subject image"));
  expect(screen.getByLabelText("Subject Name")).toHaveValue("New name");
  expect(mockGet).toHaveBeenCalledTimes(1);
  expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["subjects"] });
});
