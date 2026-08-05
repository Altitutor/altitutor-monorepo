import { parseNaturalDate } from '../lib/smart-date-parser';

describe('parseNaturalDate', () => {
  const referenceDate = new Date(2026, 0, 15, 12);

  it('interprets ambiguous numeric dates as day/month', () => {
    const parsed = parseNaturalDate('11/7', referenceDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.getDate()).toBe(11);
    expect(parsed?.getMonth()).toBe(6);
  });

  it('still parses natural-language dates', () => {
    const parsed = parseNaturalDate('tomorrow', referenceDate);

    expect(parsed).not.toBeNull();
    expect(parsed?.getDate()).toBe(16);
    expect(parsed?.getMonth()).toBe(0);
  });
});
