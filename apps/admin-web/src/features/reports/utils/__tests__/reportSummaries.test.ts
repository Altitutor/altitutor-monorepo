import type { ReportDataPoint } from '../../types';
import { buildReportSummary } from '../reportSummaries';

const data: ReportDataPoint[] = [
  {
    date: '2026-08-21',
    count: 2,
    entities: [
      { id: 'a', name: 'A', meta: { assignee: 'Alex' } },
      { id: 'b', name: 'B', meta: { assignee: 'Blair' } },
    ],
  },
  {
    date: '2026-08-22',
    count: 3,
    entities: [
      { id: 'a', name: 'A', meta: { assignee: 'Alex' } },
      { id: 'c', name: 'C', meta: { assignee: 'Alex' } },
      { id: 'd', name: 'D' },
    ],
  },
];

describe('buildReportSummary', () => {
  it('uses the final snapshot and hides staff without attributed entities', () => {
    expect(buildReportSummary(data, 'latest', ['assignee'])).toEqual({
      total: 3,
      byStaff: [{ label: 'Alex', value: 2 }],
    });
  });

  it('sums event totals while de-duplicating staff attribution', () => {
    expect(buildReportSummary(data, 'sum', ['assignee'])).toEqual({
      total: 5,
      byStaff: [
        { label: 'Alex', value: 2 },
        { label: 'Blair', value: 1 },
      ],
    });
  });
});

