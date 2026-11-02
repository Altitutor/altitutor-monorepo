export type MailboxEnvironment = "development" | "production";
export type MailboxPolicy = Readonly<{
  environment: MailboxEnvironment;
  address: string;
  allowedRecipients: readonly string[];
}>;
type Environment = Readonly<Record<string, string | undefined>>;
const addresses = {
  development: "admin@development.altitutor.com",
  production: "admin@altitutor.com",
} as const;

/** Build and preview processes both use NODE_ENV=production; it is not a deployment identity. */
export function resolveMailboxPolicy(env: Environment): MailboxPolicy {
  const target = env.VERCEL_TARGET_ENV || env.VERCEL_ENV;
  if (target && !["production", "preview", "development"].includes(target))
    throw new Error("Unknown mailbox deployment environment.");
  const detected = target === "production" ? "production" : "development";
  const explicit = env.EMAIL_ENVIRONMENT;
  if (explicit && explicit !== "development" && explicit !== "production")
    throw new Error("Invalid mailbox environment.");
  if (target && explicit && explicit !== detected)
    throw new Error("Mailbox environment conflicts with this deployment.");
  const environment = (explicit || detected) as MailboxEnvironment;
  return {
    environment,
    address: addresses[environment],
    allowedRecipients: (env.EMAIL_DEVELOPMENT_ALLOWED_RECIPIENTS || "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean),
  };
}

export function assertMailboxPolicy(policy: MailboxPolicy): void {
  if (policy.address !== addresses[policy.environment])
    throw new Error("Mailbox address does not match its environment.");
}

/** Reject the entire submission, including disallowed Cc/Bcc; never silently redirect mail. */
export function assertMailboxRecipients(
  policy: MailboxPolicy,
  recipients: {
    to: readonly string[];
    cc?: readonly string[];
    bcc?: readonly string[];
  },
): void {
  assertMailboxPolicy(policy);
  const all = [
    ...recipients.to,
    ...(recipients.cc || []),
    ...(recipients.bcc || []),
  ];
  if (
    !all.length ||
    all.some((value) => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value.trim()))
  )
    throw new Error("Valid email recipients are required.");
  if (
    policy.environment === "development" &&
    (!policy.allowedRecipients.length ||
      all.some(
        (value) =>
          !policy.allowedRecipients.includes(value.trim().toLowerCase()),
      ))
  )
    throw new Error(
      "Development email is restricted to the configured test recipients.",
    );
}
