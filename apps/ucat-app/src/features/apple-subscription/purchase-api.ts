import type { UcatAppleBillingState } from "@altitutor/shared";
import type { createApiClient } from "@/lib/api-client";

export function createAppleBillingApi(
  request: ReturnType<typeof createApiClient>,
) {
  return {
    prepare: (productId: string) =>
      request<{ accountToken: string }>("/apple/prepare", {
        method: "POST",
        body: { productId },
      }),
    verify: (transactionId: string, environment: "Production" | "Sandbox") =>
      request<UcatAppleBillingState>("/apple", {
        method: "POST",
        body: { transactionId, environment },
      }),
    release: () => request("/apple/prepare", { method: "DELETE" }),
  };
}
