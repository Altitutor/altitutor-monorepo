import {
  AppStoreServerAPIClient,
  Environment,
} from "@apple/app-store-server-library";
import type { AppleEnvironment } from "./apple-gateway";

export function appleBillingConfigured(): boolean {
  return (
    process.env.UCAT_APPLE_IAP_ENABLED === "true" &&
    Boolean(
      process.env.UCAT_APPLE_IAP_PRIVATE_KEY &&
        process.env.UCAT_APPLE_IAP_KEY_ID &&
        process.env.UCAT_APPLE_IAP_ISSUER_ID,
    )
  );
}

export function sandboxAccountAllowed(userId: string): boolean {
  return (process.env.UCAT_APPLE_SANDBOX_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(userId);
}

export function createAppleClient(
  environment: AppleEnvironment,
): AppStoreServerAPIClient {
  const key = process.env.UCAT_APPLE_IAP_PRIVATE_KEY;
  const keyId = process.env.UCAT_APPLE_IAP_KEY_ID;
  const issuerId = process.env.UCAT_APPLE_IAP_ISSUER_ID;
  if (!appleBillingConfigured() || !key || !keyId || !issuerId)
    throw new Error("Apple billing unavailable");
  return new AppStoreServerAPIClient(
    key.replace(/\\n/g, "\n"),
    keyId,
    issuerId,
    "com.altitutor.ucat",
    environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX,
  );
}
