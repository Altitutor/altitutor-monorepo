import { layoutCalendarColumns, type CalendarColumnPlacement, type CalendarInterval } from '../calendarLayout';

const minutes = (hours: number, mins: number) => hours * 60 + mins;

function byId(placements: CalendarColumnPlacement[]): Record<string, CalendarColumnPlacement> {
  return Object.fromEntries(placements.map((placement) => [placement.id, placement]));
}

function interval(id: string, start: number, end: number): CalendarInterval {
  return { id, startMinutes: start, endMinutes: end };
}

describe('layoutCalendarColumns', () => {
  it('stacks Saturday 26 Sep morning sessions that only meet at 11:00', () => {
    const placements = byId(
      layoutCalendarColumns([
        interval('12MATH', minutes(9, 30), minutes(12, 30)),
        interval('11PHYS-am', minutes(9, 30), minutes(11, 0)),
        interval('IB', minutes(9, 30), minutes(11, 0)),
        interval('9SCIE', minutes(9, 30), minutes(11, 0)),
        interval('11BIOL', minutes(11, 0), minutes(12, 30)),
        interval('9MATH', minutes(11, 0), minutes(12, 30)),
        interval('11PHYS-pm', minutes(11, 0), minutes(12, 30)),
      ]),
    );

    expect(placements['12MATH']?.columnCount).toBe(4);
    const morningShortColumns = new Set(
      ['11PHYS-am', 'IB', '9SCIE'].map((id) => placements[id]?.column),
    );
    const afternoonColumns = new Set(
      ['11BIOL', '9MATH', '11PHYS-pm'].map((id) => placements[id]?.column),
    );
    expect(afternoonColumns).toEqual(morningShortColumns);
    expect(morningShortColumns.has(placements['12MATH']?.column)).toBe(false);
  });

  it('stacks Thursday 24 Sep later classes under the earlier ones', () => {
    const placements = byId(
      layoutCalendarColumns([
        interval('12SPEC', minutes(16, 15), minutes(19, 15)),
        interval('11MATH', minutes(16, 15), minutes(17, 45)),
        interval('TRIAL', minutes(16, 45), minutes(17, 30)),
        interval('12ENGL', minutes(17, 45), minutes(19, 15)),
        interval('11CHEM', minutes(17, 45), minutes(19, 15)),
      ]),
    );

    expect(placements['12SPEC']?.columnCount).toBe(3);
    expect(new Set([placements['12ENGL']?.column, placements['11CHEM']?.column])).toEqual(
      new Set([placements['11MATH']?.column, placements['TRIAL']?.column]),
    );
    expect(placements['12SPEC']?.column).not.toBe(placements['11MATH']?.column);
    expect(placements['12SPEC']?.column).not.toBe(placements['TRIAL']?.column);
  });

  it('puts Sunday 27 Sep trial session above 9 English', () => {
    const placements = byId(
      layoutCalendarColumns([
        interval('12CHEM', minutes(9, 30), minutes(12, 30)),
        interval('UCAT', minutes(9, 30), minutes(12, 30)),
        interval('TRIAL', minutes(9, 30), minutes(10, 15)),
        interval('9ENGL', minutes(11, 0), minutes(12, 30)),
      ]),
    );

    expect(placements['TRIAL']?.columnCount).toBe(3);
    expect(placements['9ENGL']?.column).toBe(placements['TRIAL']?.column);
    expect(placements['12CHEM']?.column).not.toBe(placements['UCAT']?.column);
    expect(placements['9ENGL']?.column).not.toBe(placements['12CHEM']?.column);
    expect(placements['9ENGL']?.column).not.toBe(placements['UCAT']?.column);
  });

  it('keeps back-to-back sessions in one full-width column', () => {
    const placements = byId(
      layoutCalendarColumns([
        interval('early', minutes(9, 0), minutes(10, 0)),
        interval('later', minutes(10, 0), minutes(11, 0)),
      ]),
    );

    expect(placements['early']).toEqual({ id: 'early', column: 0, columnCount: 1 });
    expect(placements['later']).toEqual({ id: 'later', column: 0, columnCount: 1 });
  });

  it('keeps actually overlapping sessions side by side', () => {
    const placements = byId(
      layoutCalendarColumns([
        interval('a', minutes(9, 0), minutes(10, 0)),
        interval('b', minutes(9, 30), minutes(10, 30)),
      ]),
    );

    expect(placements['a']?.columnCount).toBe(2);
    expect(placements['a']?.column).not.toBe(placements['b']?.column);
  });

  it('does not widen a later block because an earlier block was busy', () => {
    const early = ['a', 'b', 'c', 'd', 'trial'].map((id) =>
      interval(id, id === 'trial' ? minutes(14, 0) : minutes(13, 15), minutes(14, 45)),
    );
    const later = ['e', 'f', 'g', 'h', 'i'].map((id) =>
      interval(id, minutes(14, 45), minutes(16, 15)),
    );
    const placements = byId(layoutCalendarColumns([...early, ...later]));

    for (const id of ['e', 'f', 'g', 'h', 'i']) {
      expect(placements[id]?.columnCount).toBe(5);
      expect(placements[id]?.column).toBeLessThan(5);
    }
  });
});
