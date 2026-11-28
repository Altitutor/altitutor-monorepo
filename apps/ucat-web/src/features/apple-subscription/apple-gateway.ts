import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  Environment,
  SignedDataVerifier,
} from "@apple/app-store-server-library";

export type AppleEnvironment = "Production" | "Sandbox";

export function createAppleVerifier(
  environment: AppleEnvironment,
): SignedDataVerifier {
  const root = join(
    process.cwd(),
    "src/features/apple-subscription/certificates",
  );
  const certificates = [
    readFileSync(join(root, "AppleRootCA-G3.cer")),
    readFileSync(join(root, "AppleRootCA-G2.cer")),
  ];
  return new SignedDataVerifier(
    certificates,
    true,
    environment === "Production" ? Environment.PRODUCTION : Environment.SANDBOX,
    "com.altitutor.ucat",
    6817081340,
  );
}

import type { AppStoreServerAPIClient } from "@apple/app-store-server-library";
import { projectVerifiedAppleSubscription } from "./verified-subscription";

type AppleClient = Pick<
  AppStoreServerAPIClient,
  "getTransactionInfo" | "getAllSubscriptionStatuses"
>;
type AppleVerifier = Pick<
  SignedDataVerifier,
  "verifyAndDecodeTransaction" | "verifyAndDecodeRenewalInfo"
>;

export async function readAppleSubscription(input: {
  transactionId: string;
  expectedAccountToken: string;
  environment: AppleEnvironment;
  client: AppleClient;
  verifier: AppleVerifier;
  now: number;
}) {
  const info = await input.client.getTransactionInfo(input.transactionId);
  if (!info.signedTransactionInfo)
    throw new Error("Apple transaction unavailable");
  const original = await input.verifier.verifyAndDecodeTransaction(
    info.signedTransactionInfo,
  );
  // Verify ownership even when the returned transaction has already expired.
  projectVerifiedAppleSubscription({
    ...input,
    transaction: original,
    status: 2,
  });
  const statuses = await input.client.getAllSubscriptionStatuses(
    input.transactionId,
  );
  const current = statuses.data
    ?.flatMap((group) => group.lastTransactions ?? [])
    .find(
      (item) => item.originalTransactionId === original.originalTransactionId,
    );
  if (
    !current?.signedTransactionInfo ||
    !current.signedRenewalInfo ||
    current.status === undefined
  ) {
    throw new Error("Current Apple subscription unavailable");
  }
  const [transaction, renewal] = await Promise.all([
    input.verifier.verifyAndDecodeTransaction(current.signedTransactionInfo),
    input.verifier.verifyAndDecodeRenewalInfo(current.signedRenewalInfo),
  ]);
  if (
    transaction.originalTransactionId !== original.originalTransactionId ||
    renewal.originalTransactionId !== original.originalTransactionId
  ) {
    throw new Error("Apple renewal does not match purchase");
  }
  return projectVerifiedAppleSubscription({
    ...input,
    transaction,
    renewal,
    status: current.status,
  });
}
