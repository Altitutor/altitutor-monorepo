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

  it('anchors typed month/day to a fixed year', () => {
    const parsed = parseNaturalDate('28 Jul', referenceDate, { anchorYear: 2027 });

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2027);
    expect(parsed?.getDate()).toBe(28);
    expect(parsed?.getMonth()).toBe(6);
  });
});
