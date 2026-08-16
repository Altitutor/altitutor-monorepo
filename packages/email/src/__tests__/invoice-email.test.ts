import { buildInvoiceNotificationEmail } from "../index";

describe("buildInvoiceNotificationEmail", () => {
  it("shows pay CTA, unpaid copy, and line items for unpaid invoices", () => {
    const email = buildInvoiceNotificationEmail({
      invoiceNumber: "ALT-1042",
      invoiceDate: "8/15/2026",
      dueDate: "9/14/2026",
      amount: "AUD $245.00",
      paid: false,
      lineItems: [
        { description: "Maths Tutoring - 8 August 2026", amount: "AUD $200.00" },
        { description: "Payment processing fee", amount: "AUD $45.00" },
      ],
      hostedInvoiceUrl: "https://invoice.stripe.com/i/abc",
      invoicePdfUrl: "https://pay.stripe.com/invoice/abc/pdf",
    });

    expect(email.subject).toBe("Invoice ALT-1042 is ready — Altitutor");
    expect(email.previewText).toBe("Invoice ALT-1042 for AUD $245.00 is ready.");
    expect(email.html).toContain("Your Altitutor invoice is ready.");
    expect(email.html).toContain("Pay invoice");
    expect(email.html).not.toContain("View and pay invoice");
    expect(email.html).toContain("Amount due");
    expect(email.html).toContain("AUD $200.00");
    expect(email.html).toContain("Payment processing fee");
    expect(email.html).toContain("15/08/2026");
    expect(email.html).toContain("14/09/2026");
    expect(email.html).toContain("Maths Tutoring - 08/08/2026");
    expect(email.html).not.toContain("8/15/2026");
    expect(email.html).toContain("AUD $245.00");
    expect(email.html).toContain("Download invoice PDF");
    expect(email.html).toContain("admin@altitutor.com");
    expect(email.html).not.toContain("support@altitutor.com");
    expect(email.text).toContain("Invoice date: 15/08/2026");
    expect(email.text).toContain("Due date: 14/09/2026");
    expect(email.text).toContain("Maths Tutoring - 08/08/2026: AUD $200.00");
    expect(email.text).toContain("Amount due: AUD $245.00");
    expect(email.text).toContain("Hosted invoice: https://invoice.stripe.com/i/abc");
  });

  it("shows view CTA and paid copy for paid invoices", () => {
    const email = buildInvoiceNotificationEmail({
      invoiceNumber: "ALT-1042",
      invoiceDate: "8/15/2026",
      dueDate: "9/14/2026",
      amount: "AUD $245.00",
      paid: true,
      lineItems: [
        { description: "Maths Tutoring - 8 August 2026", amount: "AUD $245.00" },
      ],
      hostedInvoiceUrl: "https://invoice.stripe.com/i/abc",
      invoicePdfUrl: "https://pay.stripe.com/invoice/abc/pdf",
    });

    expect(email.subject).toBe("Invoice ALT-1042 has been paid — Altitutor");
    expect(email.previewText).toBe(
      "Invoice ALT-1042 for AUD $245.00 has been paid.",
    );
    expect(email.html).toContain("Invoice ALT-1042 has been paid");
    expect(email.html).toContain("Your Altitutor invoice has been paid.");
    expect(email.html).toContain("View invoice");
    expect(email.html).not.toContain("Pay invoice");
    expect(email.html).toContain("Amount paid");
    expect(email.html).toContain("15/08/2026");
    expect(email.html).toContain("14/09/2026");
    expect(email.html).toContain("Maths Tutoring - 08/08/2026");
    expect(email.text).toContain("Amount paid: AUD $245.00");
  });
});
