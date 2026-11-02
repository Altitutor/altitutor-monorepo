import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerBalanceSummary } from "../CustomerBalanceSummary";

const fetchMock = jest.fn();

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
});

it("shows recent history and a reachable Stripe link on hover", async () => {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("/history")
        ? {
            transactions: [
              {
                id: "cbtxn_1",
                amount_cents: -5000,
                currency: "aud",
                type: "credit_note",
                description: "Missed lesson credit",
                created: 1793232000,
                ending_balance: -5000,
              },
            ],
            has_more: false,
          }
        : {
            linked: true,
            stripe_customer_id: "cus_test",
            balance_cents: -5000,
            currency: "aud",
          },
  }));
  renderSummary();
  fireEvent.mouseEnter(
    await screen.findByRole("button", { name: /Customer balance: -AUD/ }),
  );
  expect(await screen.findByText("Missed lesson credit")).toBeVisible();
  const link = screen.getByRole("link", { name: /Open in Stripe/ });
  expect(link).toHaveAttribute(
    "href",
    "https://dashboard.stripe.com/customers/cus_test",
  );
  fireEvent.mouseEnter(
    screen.getByRole("dialog", { name: "Customer balance history" }),
  );
  act(() => link.focus());
  expect(link).toHaveFocus();
});

it("makes history and the Stripe action accessible from keyboard focus", async () => {
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url.includes("/history")
        ? { transactions: [], has_more: false }
        : {
            linked: true,
            stripe_customer_id: "cus_test",
            balance_cents: 1250,
            currency: "aud",
          },
  }));
  renderSummary();
  const trigger = await screen.findByRole("button", {
    name: /Customer balance: AUD\s*12\.50 \(owing\)/,
  });
  act(() => trigger.focus());
  expect(await screen.findByText("No balance transactions.")).toBeVisible();
  const link = screen.getByRole("link", { name: /Open in Stripe/ });
  act(() => link.focus());
  expect(link).toHaveFocus();
  fireEvent.keyDown(link, { key: "Escape" });
  expect(trigger).toHaveFocus();
});

it("shows a balance failure explicitly instead of reporting zero", async () => {
  fetchMock.mockResolvedValue({ ok: false });
  renderSummary();
  expect(
    await screen.findByRole("button", {
      name: /Customer balance: Unable to load balance/,
    }),
  ).toBeVisible();
  expect(screen.queryByText(/AUD.*0\.00/)).not.toBeInTheDocument();
});

it("explains when the student has no linked Stripe customer", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      linked: false,
      stripe_customer_id: null,
      balance_cents: 0,
      currency: "aud",
    }),
  });
  renderSummary();
  const trigger = await screen.findByRole("button", {
    name: /Customer balance: No Stripe customer/,
  });
  act(() => trigger.focus());
  expect(await screen.findByText("No Stripe customer linked.")).toBeVisible();
  expect(
    screen.queryByRole("link", { name: /Open in Stripe/ }),
  ).not.toBeInTheDocument();
});

function renderSummary() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <CustomerBalanceSummary studentId="student-1" />
    </QueryClientProvider>,
  );
}

it("shows an account credit as a signed inline customer balance", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      linked: true,
      stripe_customer_id: "cus_test",
      balance_cents: -5000,
      currency: "aud",
    }),
  });
  renderSummary();
  expect(
    await screen.findByRole("button", {
      name: /Customer balance: -AUD\s*50\.00 \(credit\)/,
    }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Customer Balance" }),
  ).not.toBeInTheDocument();
});
