import * as chrono from 'chrono-node';
import { isValid } from 'date-fns';

export interface ParseNaturalDateOptions {
  /** Force parsed month/day into this calendar year. */
  anchorYear?: number;
}

export function parseNaturalDate(
  input: string,
  referenceDate: Date,
  options?: ParseNaturalDateOptions,
): Date | null {
  // Chrono's forward refiner also moves explicitly past weekdays into next week.
  const forwardDate = !/\b(?:last|past)\b/i.test(input);
  const parsed = chrono.en.GB.parseDate(input, referenceDate, { forwardDate });
  if (!parsed || !isValid(parsed)) return null;
  if (options?.anchorYear != null) {
    parsed.setFullYear(options.anchorYear);
  }
  return parsed;
}
