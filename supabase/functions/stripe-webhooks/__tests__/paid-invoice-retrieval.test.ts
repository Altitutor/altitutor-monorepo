import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import Stripe from "npm:stripe@16.6.0";
import { retrievePaidInvoiceWithLines } from "../shared/invoice-retrieval.ts";

describe("invoice.paid retrieval", () => {
  it("retrieves payment context and all lines using the pinned invoice API", async () => {
    const requests: URL[] = [];
    const stripe = new Stripe("sk_test_fixture", {
      apiVersion: "2024-06-20",
      maxNetworkRetries: 0,
      httpClient: Stripe.createFetchHttpClient(
        (input: string | URL | Request) => {
          const url = new URL(String(input));
          requests.push(url);
          if (
            Array.from(url.searchParams).filter(([key]) =>
              key.startsWith("expand[")
            ).map(([, value]) => value).includes("latest_charge")
          ) {
            return Promise.resolve(Response.json({
              error: {
                type: "invalid_request_error",
                message: "This property cannot be expanded (latest_charge).",
              },
            }, { status: 400 }));
          }
          if (url.pathname.endsWith("/lines")) {
            expect(url.searchParams.get("starting_after")).toBe("il_first");
            return Promise.resolve(Response.json({
              object: "list",
              data: [{ id: "il_second" }],
              has_more: false,
            }));
          }
          expect(
            Array.from(url.searchParams).filter(([key]) =>
              key.startsWith("expand[")
            ).map(([, value]) => value),
          ).toContain("payment_intent");
          return Promise.resolve(Response.json({
            id: "in_paid",
            object: "invoice",
            charge: "ch_paid",
            payment_intent: { id: "pi_paid", object: "payment_intent" },
            customer: { id: "cus_fixture" },
            subscription: { id: "sub_fixture" },
            lines: {
              object: "list",
              data: [{ id: "il_first" }],
              has_more: true,
            },
          }));
        },
      ),
    });
    const invoice = await retrievePaidInvoiceWithLines(stripe, "in_paid");
    expect(invoice.charge).toBe("ch_paid");
    expect(invoice.payment_intent).toMatchObject({ id: "pi_paid" });
    expect(invoice.lines.data.map((line) => line.id)).toEqual([
      "il_first",
      "il_second",
    ]);
    expect(invoice.lines.has_more).toBe(false);
    expect(requests).toHaveLength(2);
  });
});
