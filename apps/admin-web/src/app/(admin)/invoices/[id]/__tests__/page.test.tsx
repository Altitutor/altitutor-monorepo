import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import InvoiceDetailPage from "../page";

const mockToast = jest.fn();
let mockActions: { onAddCreditNote?: () => void };
let mockInvoice = {
  id: "invoice",
  status: "paid",
  stripe_invoice_id: "stripe",
  amount_due_cents: 10000,
  total_cents: 10000,
  currency: "AUD",
  invoice_date: "2026-10-06",
  collection_method: "charge_automatically",
  is_refunded: false,
  metadata: null as {
    last_payment_error?: { code: string; message: string };
  } | null,
};
const creditNote = {
  id: "note",
  status: "issued",
  amount_cents: 10000,
  currency: "AUD",
  created_at: "2026-10-06",
  refund_amount_cents: 0,
  credit_amount_cents: 0,
  out_of_band_amount_cents: 0,
};
let mockCreditNotes: (typeof creditNote)[] = [];
let mockStripe = {
  data: {
    attempt_count: 3,
    next_payment_attempt: 1791331200 as number | null,
    auto_retry_active: true,
    last_payment_error: { code: "card_declined", message: "Payment declined" },
  },
  isLoading: false,
  isError: false,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("@altitutor/ui", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  Separator: () => <hr />,
  useToast: () => ({ toast: mockToast }),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => mockStripe,
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));
jest.mock("@/shared/components/PrimaryEntityBreadcrumb", () => ({
  PrimaryEntityBreadcrumb: () => null,
}));
jest.mock("@/shared/components", () => ({ AdminLoadingSkeleton: () => null }));
jest.mock("@/shared/components/PropertyForm", () => ({
  PropertyForm: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PropertyFormRow: ({
    label,
    children,
  }: {
    label: string;
    children: ReactNode;
  }) => (
    <div>
      {label}: {children}
    </div>
  ),
}));
jest.mock("@/shared/components/ActionsMenu", () => ({
  ActionsMenu: ({
    onAddCreditNote,
    isAddCreditNoteDisabled,
    addCreditNoteDisabledReason,
  }: {
    onAddCreditNote?: () => void;
    isAddCreditNoteDisabled?: boolean;
    addCreditNoteDisabledReason?: string;
  }) =>
    onAddCreditNote ? (
      <button
        disabled={isAddCreditNoteDisabled}
        title={addCreditNoteDisabledReason}
        onClick={onAddCreditNote}
      >
        Add Credit Note
      </button>
    ) : null,
}));
jest.mock("@/features/students/components/ViewStudentModal", () => ({
  ViewStudentModal: () => null,
}));
jest.mock("@/features/sessions/components/SessionModal", () => ({
  SessionModal: () => null,
}));
jest.mock("@/features/activity/components", () => ({
  InvoiceActivityTab: () => null,
}));
jest.mock("@/shared/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
  getErrorMessage: (error: Error) => error.message,
}));
jest.mock("@/features/billing", () => ({
  useInvoiceData: () => ({
    invoice: mockInvoice,
    invoiceItems: [],
    creditNotes: mockCreditNotes,
    isLoading: false,
  }),
  useInvoiceModals: () => ({}),
  useInvoiceActions: (props: typeof mockActions) => {
    mockActions = props;
    return props;
  },
  formatInvoiceDate: (date: string) => date,
  getInvoiceStatusBadge: () => null,
  toInvoiceStatusPayload: () => null,
  formatInvoiceAmount: (cents: number) => `$${(cents / 100).toFixed(2)}`,
  calculateLineItemsSubtotal: () => 10000,
  formatInvoiceTagText: () => "Invoice",
  CreditNoteDialog: () => <div>Credit note review</div>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockInvoice = {
    ...mockInvoice,
    status: "paid",
    is_refunded: false,
    metadata: null,
  };
  mockCreditNotes = [];
  mockStripe = {
    ...mockStripe,
    isLoading: false,
    isError: false,
    data: {
      attempt_count: 3,
      next_payment_attempt: 1791331200,
      auto_retry_active: true,
      last_payment_error: {
        code: "card_declined",
        message: "Payment declined",
      },
    },
  };
});

it("opens the credit-note review for an eligible invoice", () => {
  render(<InvoiceDetailPage params={{ id: "invoice" }} />);
  fireEvent.click(screen.getByText("Add Credit Note"));
  expect(screen.getByText("Credit note review")).toBeInTheDocument();
});

it.each(["refunded", "fully credited", "legacy credit"] as const)(
  "blocks credit-note creation for an invoice that is %s",
  (reason) => {
    mockInvoice.is_refunded = reason === "refunded";
    if (reason !== "refunded")
      mockCreditNotes = [
        {
          ...creditNote,
          credit_amount_cents: reason === "legacy credit" ? 0 : 10000,
        },
      ];
    render(<InvoiceDetailPage params={{ id: "invoice" }} />);
    expect(screen.getByText("Add Credit Note")).toBeDisabled();
    mockActions.onAddCreditNote?.();
    expect(screen.queryByText("Credit note review")).not.toBeInTheDocument();
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Cannot add credit note" }),
    );
  },
);

it("ignores voided credits when determining whether another credit note can be added", () => {
  mockCreditNotes = [
    { ...creditNote, status: "void", credit_amount_cents: 10000 },
  ];
  render(<InvoiceDetailPage params={{ id: "invoice" }} />);
  expect(screen.getByText("Add Credit Note")).toBeEnabled();
});

it("shows the payment error, collection method and automatic retry details", () => {
  render(<InvoiceDetailPage params={{ id: "invoice" }} />);
  expect(screen.getByText("Charge Automatically")).toBeInTheDocument();
  expect(
    screen.getByText("card_declined: Payment declined"),
  ).toBeInTheDocument();
  expect(screen.getByText("3")).toBeInTheDocument();
  expect(screen.getByText("Yes")).toBeInTheDocument();
  expect(screen.queryByText("No retry scheduled")).not.toBeInTheDocument();
});

it("distinguishes a failed retry lookup from no scheduled retry", () => {
  mockStripe = { ...mockStripe, isError: true };
  render(<InvoiceDetailPage params={{ id: "invoice" }} />);
  expect(screen.getAllByText("Unable to load")).toHaveLength(3);
  expect(screen.queryByText("No retry scheduled")).not.toBeInTheDocument();
});

it("shows all settlement destinations on a credit note", () => {
  mockCreditNotes = [
    {
      ...creditNote,
      refund_amount_cents: 2000,
      credit_amount_cents: 3000,
      out_of_band_amount_cents: 1000,
    },
  ];
  render(<InvoiceDetailPage params={{ id: "invoice" }} />);
  expect(screen.getByText("Refunded $20.00")).toBeInTheDocument();
  expect(screen.getByText("Credited to balance $30.00")).toBeInTheDocument();
  expect(screen.getByText("Settled externally $10.00")).toBeInTheDocument();
  expect(screen.getByText("Add Credit Note")).toBeEnabled();
});
