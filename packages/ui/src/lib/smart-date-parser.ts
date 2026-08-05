import * as chrono from 'chrono-node';
import { isValid } from 'date-fns';

export function parseNaturalDate(input: string, referenceDate: Date): Date | null {
  const parsed = chrono.en.GB.parseDate(input, referenceDate, { forwardDate: true });
  if (!parsed || !isValid(parsed)) return null;
  return parsed;
}
