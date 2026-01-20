/**
 * Tests for Twilio security functions
 * These tests test the security-critical functions extracted to shared/security.ts
 */

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  timingSafeEqual,
  verifyTwilioSignature,
  parseFormEncoded,
} from '../shared/security.ts';

describe('timingSafeEqual', () => {
  it('should return true for identical strings', () => {
    const result = timingSafeEqual('test', 'test');
    expect(result).toBe(true);
  });

  it('should return false for different strings of same length', () => {
    const result = timingSafeEqual('test1', 'test2');
    expect(result).toBe(false);
  });

  it('should return false for different length strings', () => {
    const result = timingSafeEqual('test', 'test123');
    expect(result).toBe(false);
  });

  it('should return false for empty vs non-empty string', () => {
    const result = timingSafeEqual('', 'test');
    expect(result).toBe(false);
  });

  it('should return true for empty strings', () => {
    const result = timingSafeEqual('', '');
    expect(result).toBe(true);
  });

  it('should handle special characters', () => {
    const result = timingSafeEqual('test@123', 'test@123');
    expect(result).toBe(true);
  });

  it('should prevent timing attacks by comparing all bytes', () => {
    // This test verifies that the function compares all bytes
    // even if first bytes differ (timing-safe comparison)
    const result1 = timingSafeEqual('a', 'b');
    const result2 = timingSafeEqual('aa', 'ab');
    expect(result1).toBe(false);
    expect(result2).toBe(false);
  });
});

describe('parseFormEncoded', () => {
  it('should parse simple form data', () => {
    const body = 'key1=value1&key2=value2';
    const result = parseFormEncoded(body);
    expect(result).toEqual({
      key1: 'value1',
      key2: 'value2',
    });
  });

  it('should handle URL-encoded values', () => {
    const body = 'name=John+Doe&email=test%40example.com';
    const result = parseFormEncoded(body);
    expect(result).toEqual({
      name: 'John Doe',
      email: 'test@example.com',
    });
  });

  it('should handle empty values', () => {
    const body = 'key1=value1&key2=';
    const result = parseFormEncoded(body);
    expect(result).toEqual({
      key1: 'value1',
      key2: '',
    });
  });

  it('should handle empty body', () => {
    const result = parseFormEncoded('');
    expect(result).toEqual({});
  });
});

describe('verifyTwilioSignature', () => {
  const authToken = 'test-auth-token-12345';
  const baseUrl = 'https://example.com/functions/v1/twilio-inbound';

  it('should return ok: true when verification is disabled', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
      headers: { 'X-Twilio-Signature': 'test-sig' },
    });
    const bodyObj = { From: '+1234567890', To: '+0987654321' };
    const rawBody = 'From=%2B1234567890&To=%2B0987654321';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      undefined, // No auth token
      false // Verification disabled
    );

    expect(result.ok).toBe(true);
  });

  it('should return ok: false for invalid signature', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
      headers: { 'X-Twilio-Signature': 'invalid-signature' },
    });
    const bodyObj = { From: '+1234567890', To: '+0987654321' };
    const rawBody = 'From=%2B1234567890&To=%2B0987654321';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true
    );

    expect(result.ok).toBe(false);
    expect(result.provided).toBe('invalid-signature');
    expect(result.url).toBe(baseUrl);
    expect(result.tried).toBeDefined();
    expect(result.tried?.length).toBe(3); // Three candidate formats
  });

  it('should build URL from x-forwarded-proto and x-forwarded-host', async () => {
    const req = new Request('http://localhost:8000/twilio-inbound', {
      method: 'POST',
      headers: {
        'X-Twilio-Signature': 'invalid',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'api.example.com',
      },
    });
    const bodyObj = {};
    const rawBody = '';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true
    );

    expect(result.url).toBe('https://api.example.com/functions/v1/twilio-inbound');
  });

  it('should use public URL override if provided', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
      headers: { 'X-Twilio-Signature': 'invalid' },
    });
    const bodyObj = {};
    const rawBody = '';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true,
      'https://override.example.com/custom-path'
    );

    expect(result.url).toBe('https://override.example.com/custom-path');
  });

  it('should handle missing X-Twilio-Signature header', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
    });
    const bodyObj = {};
    const rawBody = '';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true
    );

    expect(result.ok).toBe(false);
    expect(result.provided).toBe('');
  });

  it('should try all three candidate signature formats', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
      headers: { 'X-Twilio-Signature': 'invalid' },
    });
    const bodyObj = { From: '+1234567890', To: '+0987654321' };
    const rawBody = 'From=%2B1234567890&To=%2B0987654321';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true
    );

    expect(result.tried).toBeDefined();
    expect(result.tried?.length).toBe(3);
    // All candidates should have length indicators
    result.tried?.forEach((tried) => {
      expect(tried).toMatch(/^len:\d+$/);
    });
  });

  it('should handle empty body', async () => {
    const req = new Request(baseUrl, {
      method: 'POST',
      headers: { 'X-Twilio-Signature': 'invalid' },
    });
    const bodyObj = {};
    const rawBody = '';

    const result = await verifyTwilioSignature(
      req,
      bodyObj,
      rawBody,
      authToken,
      true
    );

    expect(result.ok).toBe(false);
  });
});
