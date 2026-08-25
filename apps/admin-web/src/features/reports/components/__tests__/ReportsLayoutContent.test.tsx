import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { ReportsLayoutContent } from '../ReportsLayoutContent';
import { useLastAdminMeetingDate } from '../../hooks/useLastAdminMeetingDate';

const smartDatePickerProps: Array<
  ComponentProps<'button'> & {
    anchorYear?: number;
    presets?: ReadonlyArray<{ label: string; value: Date }>;
  }
> = [];

jest.mock('next/navigation', () => ({
  usePathname: () => '/reports/operations',
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@altitutor/ui', () => {
  const actual = jest.requireActual('@altitutor/ui');

  return {
    ...actual,
    SegmentedControl: () => <div>Report tabs</div>,
    SmartDatePickerField: (
      props: ComponentProps<'button'> & {
        anchorYear?: number;
        presets?: ReadonlyArray<{ label: string; value: Date }>;
      }
    ) => {
      smartDatePickerProps.push(props);
      return <button type="button">Date picker</button>;
    },
  };
});

jest.mock('../../hooks/useLastAdminMeetingDate', () => ({
  useLastAdminMeetingDate: jest.fn(() => ({ data: undefined })),
}));

jest.mock('../../context/ReportsContext', () => ({
  useReportsContext: () => ({
    startDate: '2026-08-01',
    endDate: '2026-08-22',
    setStartDate: jest.fn(),
    setEndDate: jest.fn(),
    visibleCharts: {
      operations: {
        tasks: { taskMetrics: true, taskStatusBreakdown: true, taskCompletionTrend: true },
        issues: { issueMetrics: true, issueStatusBreakdown: true },
        projects: { projectMetrics: true, projectStatusBreakdown: true },
      },
      scheduling: {
        sessions: { sessionMetrics: true, sessionsOverTime: true, cancellationReasons: true },
        students: { studentMetrics: true, studentGrowth: true, studentsByStatus: true },
        staff: { staffMetrics: true, staffGrowth: true, staffByStatus: true },
        classes: { classMetrics: true, classGrowth: true, classesByStatus: true },
      },
      financial: {
        financialMetrics: true,
        monthlyRevenue: true,
        revenueByType: true,
        revenueByPaymentStatus: true,
      },
    },
    handleOperationsChartToggle: jest.fn(),
    handleSchedulingChartToggle: jest.fn(),
    handleFinancialChartToggle: jest.fn(),
  }),
}));

const mockUseLastAdminMeetingDate = useLastAdminMeetingDate as jest.MockedFunction<
  typeof useLastAdminMeetingDate
>;

describe('ReportsLayoutContent', () => {
  beforeEach(() => {
    smartDatePickerProps.length = 0;
    mockUseLastAdminMeetingDate.mockReturnValue({ data: undefined } as ReturnType<
      typeof useLastAdminMeetingDate
    >);
  });

  it('anchors partial dates to the current year so past report dates remain selectable', () => {
    render(<ReportsLayoutContent>Report</ReportsLayoutContent>);

    expect(screen.getAllByRole('button', { name: 'Date picker' })).toHaveLength(2);
    expect(smartDatePickerProps).toHaveLength(2);
    expect(smartDatePickerProps.every((props) => props.anchorYear === new Date().getFullYear())).toBe(
      true
    );
  });

  it('provides the reporting date presets to both date fields', () => {
    render(<ReportsLayoutContent>Report</ReportsLayoutContent>);

    const expectedLabels = [
      'Today',
      'Yesterday',
      'Last week',
      'Start of this month',
      'Start of this quarter',
      'Start of this year',
    ];
    expect(smartDatePickerProps).toHaveLength(2);
    expect(smartDatePickerProps.every((props) =>
      props.presets?.map((preset) => preset.label).join('|') === expectedLabels.join('|')
    )).toBe(true);
  });

  it('includes last admin meeting in both date fields when a meeting date is known', () => {
    mockUseLastAdminMeetingDate.mockReturnValue({
      data: new Date(2026, 7, 18),
    } as ReturnType<typeof useLastAdminMeetingDate>);

    render(<ReportsLayoutContent>Report</ReportsLayoutContent>);

    expect(smartDatePickerProps).toHaveLength(2);
    expect(
      smartDatePickerProps.every(
        (props) => props.presets?.map((preset) => preset.label)[2] === 'Last admin meeting'
      )
    ).toBe(true);
  });
});
