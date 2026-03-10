'use client';

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { format } from 'date-fns';
import type {
  ReportsDateRange,
  ReportsVisibleCharts,
  OperationsSubsection,
  SchedulingSubsection,
} from '../components/ReportsDateRangeCard';
import {
  getDefaultReportsDateRange,
  DEFAULT_VISIBLE_CHARTS,
} from '../components/ReportsDateRangeCard';

const TODAY = format(new Date(), 'yyyy-MM-dd');

interface ReportsContextValue {
  startDate: string;
  endDate: string;
  dateRange: ReportsDateRange;
  visibleCharts: ReportsVisibleCharts;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setVisibleCharts: (v: ReportsVisibleCharts) => void;
  handleOperationsChartToggle: (
    subsection: OperationsSubsection,
    chart: string,
    checked: boolean
  ) => void;
  handleSchedulingChartToggle: (
    subsection: SchedulingSubsection,
    chart: string,
    checked: boolean
  ) => void;
  handleFinancialChartToggle: (
    chart: keyof ReportsVisibleCharts['financial'],
    checked: boolean
  ) => void;
}

const ReportsContext = createContext<ReportsContextValue | null>(null);

export function useReportsContext(): ReportsContextValue {
  const ctx = useContext(ReportsContext);
  if (!ctx) throw new Error('useReportsContext must be used within ReportsProvider');
  return ctx;
}

interface ReportsProviderProps {
  children: ReactNode;
}

export function ReportsProvider({ children }: ReportsProviderProps) {
  const defaultRange = useMemo(() => getDefaultReportsDateRange(), []);
  const [startDate, setStartDateState] = useState(() =>
    format(defaultRange.start, 'yyyy-MM-dd')
  );
  const [endDate, setEndDateState] = useState(() => format(defaultRange.end, 'yyyy-MM-dd'));
  const [visibleCharts, setVisibleCharts] = useState(DEFAULT_VISIBLE_CHARTS);

  const dateRange = useMemo(
    () => ({
      start: new Date(startDate),
      end: new Date(endDate),
    }),
    [startDate, endDate]
  );

  const setStartDate = useCallback((value: string) => {
    if (!value) return;
    const v = value > TODAY ? TODAY : value;
    setStartDateState(v);
    setEndDateState((e) => (v > e ? v : e));
  }, []);

  const setEndDate = useCallback((value: string) => {
    if (!value) return;
    const v = value > TODAY ? TODAY : value;
    setEndDateState(v);
    setStartDateState((s) => (v < s ? v : s));
  }, []);

  const handleOperationsChartToggle = useCallback(
    (subsection: OperationsSubsection, chart: string, checked: boolean) => {
      setVisibleCharts((prev) => ({
        ...prev,
        operations: {
          ...prev.operations,
          [subsection]: {
            ...prev.operations[subsection],
            [chart]: checked,
          },
        },
      }));
    },
    []
  );

  const handleSchedulingChartToggle = useCallback(
    (subsection: SchedulingSubsection, chart: string, checked: boolean) => {
      setVisibleCharts((prev) => ({
        ...prev,
        scheduling: {
          ...prev.scheduling,
          [subsection]: {
            ...prev.scheduling[subsection],
            [chart]: checked,
          },
        },
      }));
    },
    []
  );

  const handleFinancialChartToggle = useCallback(
    (chart: keyof ReportsVisibleCharts['financial'], checked: boolean) => {
      setVisibleCharts((prev) => ({
        ...prev,
        financial: { ...prev.financial, [chart]: checked },
      }));
    },
    []
  );

  const value = useMemo<ReportsContextValue>(
    () => ({
      startDate,
      endDate,
      dateRange,
      visibleCharts,
      setStartDate,
      setEndDate,
      setVisibleCharts,
      handleOperationsChartToggle,
      handleSchedulingChartToggle,
      handleFinancialChartToggle,
    }),
    [
      startDate,
      endDate,
      dateRange,
      visibleCharts,
      setStartDate,
      setEndDate,
      handleOperationsChartToggle,
      handleSchedulingChartToggle,
      handleFinancialChartToggle,
    ]
  );

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}
