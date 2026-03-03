'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ReportDataPoint } from '../types';

interface IssuesReportChartProps {
  data: ReportDataPoint[];
  title: string;
  barColor?: string;
  onBarClick?: (point: ReportDataPoint) => void;
  /**
   * Singular label for the entity being counted (e.g. "issue", "student").
   * Defaults to "issue".
   */
  entityLabelSingular?: string;
}

function CustomTooltip({
  active,
  payload,
  entityLabelSingular = 'issue',
}: {
  active?: boolean;
  payload?: Array<{ payload: ReportDataPoint }>;
  entityLabelSingular?: string;
}) {
  if (!active || !payload?.length) return null;

  const dataPoint = payload[0].payload;
  const { date, count } = dataPoint;
  const pluralized =
    count === 1 ? entityLabelSingular : `${entityLabelSingular}s`;

  return (
    <div className="rounded-lg border bg-background dark:bg-brand-dark-bg px-3 py-2 shadow-md">
      <p className="font-medium">{date}</p>
      <p className="text-sm text-muted-foreground">
        {count} {pluralized}
      </p>
    </div>
  );
}

export function IssuesReportChart({
  data,
  title,
  barColor = '#0a2941',
  onBarClick,
  entityLabelSingular = 'issue',
}: IssuesReportChartProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const highlightColor = '#144e72';

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
            }}
          />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip entityLabelSingular={entityLabelSingular} />} />
          <Bar
            dataKey="count"
            name={title}
            radius={[4, 4, 0, 0]}
            onClick={(entry) => {
              if (!onBarClick || !entry?.payload) return;
              onBarClick(entry.payload as ReportDataPoint);
            }}
          >
            {data.map((point, index) => {
              const isToday = point.date === todayStr;
              return (
                <Cell
                  key={`cell-${index}`}
                  fill={isToday ? highlightColor : barColor}
                  stroke={isToday ? highlightColor : undefined}
                  strokeWidth={isToday ? 1.5 : 1}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
