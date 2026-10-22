import { parseNaturalDate } from '../lib/smart-date-parser';

describe('parseNaturalDate', () => {
  const referenceDate = new Date(2026, 0, 15, 12);

  it('respects last Wednesday instead of forwarding it into the future', () => {
    const parsed = parseNaturalDate('last wednesday', new Date(2026, 9, 19, 12));

    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(9);
    expect(parsed?.getDate()).toBe(14);
  });

  it.each([
    ['last monday', 12],
    ['past wednesday', 14],
    ['wednesday of last week', 14],
    ['yesterday', 18],
    ['three days ago', 16],
    ['wednesday', 21],
    ['next wednesday', 28],
  ])('parses %s with its intended direction', (input, day) => {
    const parsed = parseNaturalDate(input, new Date(2026, 9, 19, 12));
    expect(parsed?.getDate()).toBe(day);
    expect(parsed?.getMonth()).toBe(9);
  });

  it('keeps unqualified month/day dates forward-looking', () => {
    expect(parseNaturalDate('11/7', new Date(2026, 9, 19, 12))?.getFullYear()).toBe(2027);
  });

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
