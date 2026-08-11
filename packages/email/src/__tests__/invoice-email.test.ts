import { buildInvoiceNotificationEmail } from "../index";

describe("buildInvoiceNotificationEmail", () => {
  it("links to Stripe's authoritative invoice without presenting the email as the invoice", () => {
    const email = buildInvoiceNotificationEmail({
      invoiceNumber: "ALT-1042",
      invoiceDate: "8 August 2026",
      dueDate: "15 August 2026",
      amount: "AUD $245.00",
      hostedInvoiceUrl: "https://invoice.stripe.com/i/abc",
      invoicePdfUrl: "https://pay.stripe.com/invoice/abc/pdf",
    });

    expect(email.subject).toBe("Invoice ALT-1042 is ready — Altitutor");
    expect(email.html).toContain("AUD $245.00");
    expect(email.html).toContain("View and pay invoice");
    expect(email.html).toContain("Download invoice PDF");
    expect(email.html).toContain('class="email-strong"');
    expect(email.html).toContain('class="email-accent"');
    expect(email.html).toContain(".email-panel td");
    expect(email.html).toContain("color: #b7d4df !important");
    expect(email.html).toContain("admin@altitutor.com");
    expect(email.html).not.toContain("support@altitutor.com");
    expect(email.text).toContain("Hosted invoice: https://invoice.stripe.com/i/abc");
  });
});
