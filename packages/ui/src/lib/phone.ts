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

export interface StudentPhoneValidationResult {
  phone: string | null;
  error?: string;
}

/**
 * Normalizes an optional student phone for storage.
 * Returns null when empty or country-code-only. AU E.164 only (matches DB constraint).
 */
export function validateOptionalStudentPhone(
  value: string | undefined,
): StudentPhoneValidationResult {
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

  if (parsed.country !== 'AU') {
    return {
      phone: null,
      error: 'Only Australian mobile numbers are supported.',
    };
  }

  return { phone: parsed.format('E.164') };
}
