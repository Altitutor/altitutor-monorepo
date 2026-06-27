'use client';

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { format } from 'date-fns';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
import { useAdminUrlSync } from '@/shared/hooks/useAdminUrlSync';

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

function commitDateRangeToUrl(
  pathname: string,
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  from: string,
  to: string,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('from', from);
  params.set('to', to);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}

export function ReportsProvider({ children }: ReportsProviderProps) {
  useAdminUrlSync();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const defaultRange = useMemo(() => getDefaultReportsDateRange(), []);
  const defaultFrom = format(defaultRange.start, 'yyyy-MM-dd');
  const defaultTo = format(defaultRange.end, 'yyyy-MM-dd');

  const [startDate, setStartDateState] = useState(
    () => searchParams.get('from') || defaultFrom,
  );
  const [endDate, setEndDateState] = useState(
    () => searchParams.get('to') || defaultTo,
  );
  const [visibleCharts, setVisibleCharts] = useState(DEFAULT_VISIBLE_CHARTS);
  const hasSyncedInitialDates = useRef(false);

  useEffect(() => {
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    if (from) setStartDateState(from);
    if (to) setEndDateState(to);
  }, [searchParams]);

  useEffect(() => {
    if (hasSyncedInitialDates.current) return;
    const hasRange = searchParams.has('from') || searchParams.has('to');
    if (hasRange) {
      hasSyncedInitialDates.current = true;
      return;
    }
    hasSyncedInitialDates.current = true;
    commitDateRangeToUrl(pathname, searchParams, router, defaultFrom, defaultTo);
  }, [defaultFrom, defaultTo, pathname, router, searchParams]);

  const dateRange = useMemo(
    () => ({
      start: new Date(startDate),
      end: new Date(endDate),
    }),
    [startDate, endDate]
  );

  const setStartDate = useCallback(
    (value: string) => {
      if (!value) return;
      const v = value > TODAY ? TODAY : value;
      setStartDateState(v);
      setEndDateState((e) => {
        const nextEnd = v > e ? v : e;
        commitDateRangeToUrl(pathname, searchParams, router, v, nextEnd);
        return nextEnd;
      });
    },
    [pathname, router, searchParams],
  );

  const setEndDate = useCallback(
    (value: string) => {
      if (!value) return;
      const v = value > TODAY ? TODAY : value;
      setEndDateState(v);
      setStartDateState((s) => {
        const nextStart = v < s ? v : s;
        commitDateRangeToUrl(pathname, searchParams, router, nextStart, v);
        return nextStart;
      });
    },
    [pathname, router, searchParams],
  );

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
