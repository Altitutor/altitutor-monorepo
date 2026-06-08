import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

/** True when the value is empty or only a bare country calling code (e.g. "+61"). */
export function isPhoneCountryCodeOnly(value: string | undefined): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;

  try {
    const parsed = parsePhoneNumber(trimmed);
    if (!parsed) return true;
    return parsed.nationalNumber.length === 0;
  } catch {
    return true;
  }
}

export interface PhoneValidationResult {
  phone: string | null;
  error?: string;
}

/**
 * Normalizes an optional phone for storage as international E.164.
 * Returns null when empty or country-code-only.
 */
export function validateOptionalPhoneE164(
  value: string | undefined,
): PhoneValidationResult {
  const trimmed = value?.trim();
  if (!trimmed || isPhoneCountryCodeOnly(trimmed)) {
    return { phone: null };
  }

  if (!isValidPhoneNumber(trimmed)) {
    return {
      phone: null,
      error: 'Enter a valid phone number, or leave the field blank.',
    };
  }

  const parsed = parsePhoneNumber(trimmed);
  if (!parsed) {
    return {
      phone: null,
      error: 'Enter a valid phone number, or leave the field blank.',
    };
  }

  return { phone: parsed.format('E.164') };
}

/** @deprecated Use validateOptionalPhoneE164 */
export const validateOptionalStudentPhone = validateOptionalPhoneE164;
