/**
 * Authorization utilities for billing-single Edge Function
 * Extracted for testability
 */

export interface AuthResult {
  authorized: boolean;
  isServiceRole?: boolean;
  isAdminUser?: boolean;
  error?: string;
}

/**
 * Check if request is from service role
 */
export function isServiceRoleRequest(
  apiKey: string | null,
  bearerToken: string | null,
  serviceKey: string
): boolean {
  return apiKey === serviceKey || bearerToken === serviceKey;
}

/**
 * Check if Stripe key is valid (test or live)
 */
export function isValidStripeKey(secretKey: string | undefined): boolean {
  if (!secretKey) return false;
  const trimmed = secretKey.trim();
  return trimmed.startsWith('sk_test_') || trimmed.startsWith('sk_live_');
}

/**
 * Validate authorization for billing-single function
 * Returns authorization result
 */
export function validateBillingAuthorization(
  isServiceRole: boolean,
  isAdminUser: boolean,
  isValidStripeKey: boolean
): AuthResult {
  // Service role requests are always authorized
  if (isServiceRole) {
    return {
      authorized: true,
      isServiceRole: true,
    };
  }

  // Admin users are authorized if Stripe key is valid
  if (isAdminUser) {
    if (!isValidStripeKey) {
      return {
        authorized: false,
        isAdminUser: true,
        error: 'Invalid Stripe key configuration',
      };
    }
    return {
      authorized: true,
      isAdminUser: true,
    };
  }

  // Neither service role nor admin user
  return {
    authorized: false,
    error: 'Unauthorized: Service role or admin staff required',
  };
}
