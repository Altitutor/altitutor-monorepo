import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DuplicateStudentsPage } from "../DuplicateStudentsPage";
import { mergeRead, mergeRequest } from "../../api";

jest.mock("../../api");
const read = jest.mocked(mergeRead);
const request = jest.mocked(mergeRequest);
const first = "fd510000-0000-4000-8000-000000000001";
const second = "fd510000-0000-4000-8000-000000000002";
const student = {
  first_name: "Merge",
  last_name: "Fixture",
  created_at: "2026-01-01",
  status: null,
  email: null,
  phone: null,
  parents: [],
  billing: null,
  user_id: null,
  sign_in_methods: [],
  saved_cards: [],
  login_email: null,
};

function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DuplicateStudentsPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  read.mockResolvedValue([
    {
      a_id: first,
      b_id: second,
      a_name: "Merge Fixture",
      b_name: "Merge Fixture",
      reasons: ["Same full name"],
      fingerprint: "candidate",
    },
  ]);
  request.mockImplementation(async (input) =>
    input.action === "preview"
      ? {
          students: [
            { ...student, id: first, year_level: 10 },
            { ...student, id: second, year_level: 11 },
          ],
          counts: {},
          blockers: [],
          fingerprint: "fresh-preview",
        }
      : first,
  );
});

it("requires a conflict choice and both confirmations before sending the merge", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(await screen.findByRole("button", { name: "Review" }));
  const confirm = await screen.findByRole("button", {
    name: "Confirm student merge",
  });
  expect(confirm).toBeDisabled();
  await user.click(
    screen.getByLabelText(
      "I have confirmed that these records represent the same person.",
    ),
  );
  await user.click(
    screen.getByLabelText(
      "I have reviewed the parent access and resulting details.",
    ),
  );
  expect(confirm).toBeDisabled();
  await user.selectOptions(screen.getByLabelText("Keep Year level"), "source");
  expect(confirm).toBeEnabled();
  await user.click(confirm);
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "merge",
        fingerprint: "fresh-preview",
        choices: expect.objectContaining({
          fields: { year_level: "source" },
          confirmed_same_person: true,
          reviewed_parent_access: true,
        }),
      }),
    ),
  );
  expect(
    await screen.findByText("Students merged.", { exact: false }),
  ).toBeInTheDocument();
});

it("keeps separate dismisses a suggestion without merging records", async () => {
  const user = userEvent.setup();
  mount();
  await user.click(
    await screen.findByRole("button", { name: "Keep separate" }),
  );
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith({
      action: "dismiss",
      a: first,
      b: second,
      fingerprint: "candidate",
    }),
  );
  expect(request).not.toHaveBeenCalledWith(
    expect.objectContaining({ action: "merge" }),
  );
});
