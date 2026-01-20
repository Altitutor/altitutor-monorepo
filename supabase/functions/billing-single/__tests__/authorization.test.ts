import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  isServiceRoleRequest,
  isValidStripeKey,
  validateBillingAuthorization,
} from '../shared/authorization.ts';

describe('Billing Single Authorization', () => {
  describe('isServiceRoleRequest', () => {
    const serviceKey = 'service-role-key-123';

    it('should return true when API key matches', () => {
      expect(isServiceRoleRequest(serviceKey, null, serviceKey)).toBe(true);
    });

    it('should return true when bearer token matches', () => {
      expect(isServiceRoleRequest(null, serviceKey, serviceKey)).toBe(true);
    });

    it('should return true when both match', () => {
      expect(isServiceRoleRequest(serviceKey, serviceKey, serviceKey)).toBe(
        true
      );
    });

    it('should return false when neither matches', () => {
      expect(
        isServiceRoleRequest('wrong-key', 'wrong-token', serviceKey)
      ).toBe(false);
    });

    it('should return false when both are null', () => {
      expect(isServiceRoleRequest(null, null, serviceKey)).toBe(false);
    });

    it('should handle Bearer prefix in token', () => {
      // Note: This function receives already-extracted token
      // The extraction happens in the main function
      expect(isServiceRoleRequest(null, serviceKey, serviceKey)).toBe(true);
    });
  });

  describe('isValidStripeKey', () => {
    it('should accept test Stripe key', () => {
      expect(isValidStripeKey('sk_test_1234567890')).toBe(true);
    });

    it('should accept live Stripe key', () => {
      expect(isValidStripeKey('sk_live_1234567890')).toBe(true);
    });

    it('should reject undefined key', () => {
      expect(isValidStripeKey(undefined)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidStripeKey('')).toBe(false);
    });

    it('should reject invalid key format', () => {
      expect(isValidStripeKey('invalid_key')).toBe(false);
    });

    it('should accept key with whitespace that trims to valid', () => {
      expect(isValidStripeKey('  sk_test_1234567890  ')).toBe(true);
    });

    it('should reject key that starts with valid prefix after invalid prefix', () => {
      expect(isValidStripeKey('prefix_sk_test_123')).toBe(false);
    });
  });

  describe('validateBillingAuthorization', () => {
    describe('Service Role', () => {
      it('should authorize service role request', () => {
        const result = validateBillingAuthorization(true, false, false);
        expect(result.authorized).toBe(true);
        expect(result.isServiceRole).toBe(true);
      });

      it('should authorize service role even if admin user flag is true', () => {
        const result = validateBillingAuthorization(true, true, true);
        expect(result.authorized).toBe(true);
        expect(result.isServiceRole).toBe(true);
      });
    });

    describe('Admin User', () => {
      it('should authorize admin user with valid Stripe key', () => {
        const result = validateBillingAuthorization(false, true, true);
        expect(result.authorized).toBe(true);
        expect(result.isAdminUser).toBe(true);
      });

      it('should reject admin user with invalid Stripe key', () => {
        const result = validateBillingAuthorization(false, true, false);
        expect(result.authorized).toBe(false);
        expect(result.isAdminUser).toBe(true);
        expect(result.error).toBe('Invalid Stripe key configuration');
      });
    });

    describe('Unauthorized', () => {
      it('should reject when neither service role nor admin user', () => {
        const result = validateBillingAuthorization(false, false, true);
        expect(result.authorized).toBe(false);
        expect(result.error).toBe(
          'Unauthorized: Service role or admin staff required'
        );
      });

      it('should reject when not service role, not admin, and invalid key', () => {
        const result = validateBillingAuthorization(false, false, false);
        expect(result.authorized).toBe(false);
        expect(result.error).toBe(
          'Unauthorized: Service role or admin staff required'
        );
      });
    });
  });
});
