import { format } from 'date-fns';
import { getReportsDatePresets } from '../ReportsDateRangeCard';

describe('getReportsDatePresets', () => {
  it('builds the reporting shortcuts from a fixed reference date', () => {
    const presets = getReportsDatePresets(new Date(2026, 7, 22, 12));

    expect(presets.map((preset) => [preset.label, format(preset.value, 'yyyy-MM-dd')])).toEqual([
      ['Today', '2026-08-22'],
      ['Yesterday', '2026-08-21'],
      ['Last week', '2026-08-10'],
      ['Start of this month', '2026-08-01'],
      ['Start of this quarter', '2026-07-01'],
      ['Start of this year', '2026-01-01'],
    ]);
  });
});

