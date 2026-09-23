import React from "react";
import { render, screen, within } from "@testing-library/react";
import { InvoicesTable } from "../InvoicesTable";
import { useInvoicesWithItems } from "../../hooks";
import { useCreditBalance } from "../../hooks/useCreditBalance";
import { useFutureInvoices } from "../../hooks/useFutureInvoices";

Object.assign(globalThis, { React });

jest.mock("@altitutor/ui", () => ({
  Table: ({ children }: React.PropsWithChildren) => <table>{children}</table>,
  TableBody: ({ children }: React.PropsWithChildren) => (
    <tbody>{children}</tbody>
  ),
  TableCell: ({ children, ...props }: React.PropsWithChildren) => (
    <td {...props}>{children}</td>
  ),
  TableHead: ({ children }: React.PropsWithChildren) => <th>{children}</th>,
  TableHeader: ({ children }: React.PropsWithChildren) => (
    <thead>{children}</thead>
  ),
  TableRow: ({ children, ...props }: React.PropsWithChildren) => (
    <tr {...props}>{children}</tr>
  ),
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Button: ({ children }: React.PropsWithChildren) => (
    <button>{children}</button>
  ),
  TablePagination: () => null,
  PAID_INVOICE_BADGE_VARIANT: "default",
  SkeletonTable: () => <div>Loading</div>,
}));

jest.mock("../../hooks", () => ({
  useInvoicesWithItems: jest.fn(),
}));

jest.mock("../../hooks/useCreditBalance", () => ({
  useCreditBalance: jest.fn(),
}));

jest.mock("../../hooks/useFutureInvoices", () => ({
  useFutureInvoices: jest.fn(),
}));

const mockedUseInvoicesWithItems = jest.mocked(useInvoicesWithItems);
const mockedUseCreditBalance = jest.mocked(useCreditBalance);
const mockedUseFutureInvoices = jest.mocked(useFutureInvoices);

describe("InvoicesTable future invoices", () => {
  it("shows a muted future row with credit-adjusted amount and no action", () => {
    mockedUseInvoicesWithItems.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useInvoicesWithItems>);
    mockedUseFutureInvoices.mockReturnValue({
      data: [
        {
          sessions_students_id: "assignment-1",
          subject_id: "subject-1",
          session_name: "Mathematics A - Thursday, 1 October 2026, 10:30 am",
          session_start_at: "2026-10-01T00:00:00.000Z",
          full_amount_cents: 10_000,
          prior_charge_cents: 2_000,
          currency: "aud",
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof useFutureInvoices>);
    mockedUseCreditBalance.mockReturnValue({
      data: {
        linked: true,
        balance_cents: -6_000,
        currency: "aud",
        updated_at: "2026-09-23T00:00:00.000Z",
      },
      isLoading: false,
    } as unknown as ReturnType<typeof useCreditBalance>);

    render(<InvoicesTable />);

    const futureRow = screen
      .getByText("Mathematics A - Thursday, 1 October 2026, 10:30 am")
      .closest("tr");
    expect(futureRow).not.toBeNull();
    expect(futureRow).toHaveClass("bg-muted/35");
    expect(within(futureRow!).getByText("$100.00")).toHaveClass("line-through");
    expect(within(futureRow!).getByText("$60.00")).toHaveClass(
      "text-muted-foreground",
    );
    expect(within(futureRow!).getByText("Credit applied")).toBeInTheDocument();
    expect(within(futureRow!).getByText("Future")).toBeInTheDocument();
    expect(within(futureRow!).queryByRole("button")).not.toBeInTheDocument();
    expect(within(futureRow!).queryByRole("link")).not.toBeInTheDocument();
  });
});
