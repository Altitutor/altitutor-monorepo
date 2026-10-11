export type SentryCollectionInput = {
  dsn?: string;
  deploymentEnvironment?: string;
  explicitEnvironment?: string;
  nodeEnvironment?: string;
  ci?: string;
  disabled?: string;
  testOptIn?: string;
  hostname?: string;
  productionHosts?: readonly string[];
};

/** Deployment identity enables collection; NODE_ENV and Sentry tags never do. */
export function resolveSentryCollection(input: SentryCollectionInput): {
  errors: boolean;
  feedback: boolean;
  environment: string;
} {
  const deployment = input.deploymentEnvironment?.trim() || 'local';
  const testing = input.testOptIn === 'true';
  const environment = testing
    ? 'sentry-test'
    : input.explicitEnvironment?.trim() || deployment;
  const ci = input.ci?.trim().toLowerCase();
  const off = !input.dsn?.trim() || input.disabled === 'true' ||
    (Boolean(ci) && ci !== '0' && ci !== 'false') || input.nodeEnvironment === 'test';
  if (off) return { errors: false, feedback: false, environment };

  const productionHost = !input.productionHosts ||
    (input.hostname !== undefined && input.productionHosts.includes(input.hostname));
  const errors = testing || (deployment === 'production' &&
    input.nodeEnvironment === 'production' && productionHost);
  // SDK initialization for explicit feedback does not authorize automatic events.
  return { errors, feedback: true, environment };
}
