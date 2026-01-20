import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  validateWebhookSecret,
  validateStripeEnv,
  validateSignatureHeader,
} from '../shared/validation.ts';

describe('Stripe Webhook Validation', () => {
  describe('validateWebhookSecret', () => {
    it('should accept valid webhook secret starting with whsec_', () => {
      const result = validateWebhookSecret('whsec_test123456789');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing webhook secret', () => {
      const result = validateWebhookSecret(undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing webhook secret');
    });

    it('should reject empty webhook secret', () => {
      const result = validateWebhookSecret('');
      expect(result.valid).toBe(false);
      // Empty string is treated as missing after trim
      expect(result.error).toBe('Missing webhook secret');
    });

    it('should reject webhook secret not starting with whsec_', () => {
      const result = validateWebhookSecret('invalid_secret');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook secret format - must start with whsec_');
    });

    it('should accept webhook secret with whitespace that trims to valid format', () => {
      const result = validateWebhookSecret('  whsec_test123456789  ');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject webhook secret that starts with whsec_ after trimming but has invalid prefix', () => {
      const result = validateWebhookSecret('  invalid_prefix_whsec_test  ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook secret format - must start with whsec_');
    });
  });

  describe('validateStripeEnv', () => {
    it('should accept valid Stripe environment variables', () => {
      const result = validateStripeEnv('sk_test_123', 'whsec_test123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing secret key', () => {
      const result = validateStripeEnv(undefined, 'whsec_test123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Stripe environment variables');
    });

    it('should reject missing webhook secret', () => {
      const result = validateStripeEnv('sk_test_123', undefined);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Stripe environment variables');
    });

    it('should reject invalid webhook secret format', () => {
      const result = validateStripeEnv('sk_test_123', 'invalid_secret');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook secret format - must start with whsec_');
    });

    it('should reject empty strings', () => {
      const result = validateStripeEnv('', '');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing Stripe environment variables');
    });
  });

  describe('validateSignatureHeader', () => {
    it('should accept valid signature header', () => {
      const result = validateSignatureHeader('t=1234567890,v1=signature123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject missing signature header', () => {
      const result = validateSignatureHeader(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing stripe-signature header');
    });

    it('should reject empty signature header', () => {
      const result = validateSignatureHeader('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing stripe-signature header');
    });

    it('should accept signature with multiple parts', () => {
      const result = validateSignatureHeader('t=1234567890,v1=abc,v0=def');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
