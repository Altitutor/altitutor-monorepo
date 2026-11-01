import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EmailParticipant } from "../EmailParticipant";
const openEntity = jest.fn();
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({ openEntity }),
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  openEntity.mockClear();
});
it("does not offer linking while resolving an existing contact and opens its entity chip on the left", async () => {
  let resolve: (value: Response) => void = () => {};
  global.fetch = jest.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <EmailParticipant
        email="parent@example.test"
        label="Sender label"
        mailboxAddress="admin@example.test"
        threadId="one"
      />
    </QueryClientProvider>,
  );
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  await act(async () =>
    resolve({
      ok: true,
      json: async () => ({
        person: { id: "parent-one", type: "parent", label: "Jane Parent" },
        ambiguous: false,
      }),
    } as Response),
  );
  const chip = await screen.findByRole("button", { name: "Jane Parent" });
  expect(chip.querySelector("svg")).not.toBeNull();
  fireEvent.click(chip);
  expect(openEntity).toHaveBeenCalledWith("parent", "parent-one");
  expect(screen.queryByText("Link existing contact")).not.toBeInTheDocument();
});
