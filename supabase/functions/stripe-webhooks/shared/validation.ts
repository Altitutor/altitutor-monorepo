/**
 * Validation utilities for Stripe webhooks
 * Extracted for testability
 */

/**
 * Validate Stripe webhook secret format
 * Must start with 'whsec_'
 */
export function validateWebhookSecret(secret: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!secret) {
    return { valid: false, error: 'Missing webhook secret' };
  }

  const trimmed = secret.trim();
  if (!trimmed.startsWith('whsec_')) {
    return {
      valid: false,
      error: 'Invalid webhook secret format - must start with whsec_',
    };
  }

  return { valid: true };
}

/**
 * Validate required Stripe environment variables
 */
export function validateStripeEnv(
  secretKey: string | undefined,
  webhookSecret: string | undefined
): {
  valid: boolean;
  error?: string;
} {
  if (!secretKey || !webhookSecret) {
    return {
      valid: false,
      error: 'Missing Stripe environment variables',
    };
  }

  const webhookValidation = validateWebhookSecret(webhookSecret);
  if (!webhookValidation.valid) {
    return webhookValidation;
  }

  return { valid: true };
}

/**
 * Check if webhook signature header is present
 */
export function validateSignatureHeader(signature: string | null): {
  valid: boolean;
  error?: string;
} {
  if (!signature) {
    return {
      valid: false,
      error: 'Missing stripe-signature header',
    };
  }

  return { valid: true };
}
