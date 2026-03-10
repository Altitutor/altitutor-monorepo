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
import type { RevenueReportDataPoint } from '../types';
import { ReportsEntitiesTable, type ReportsEntitiesTableVariant } from './ReportsEntitiesTable';

type RevenueReportEntity = RevenueReportDataPoint['entities'][number];

interface RevenueReportChartProps {
  data: RevenueReportDataPoint[];
  title: string;
  barColor?: string;
  currency?: string;
  /**
   * Called when an entity is clicked. Entity is clickable when this is provided and entity has a link.
   */
  onEntityClick?: (entity: RevenueReportEntity) => void;
}

function RevenueTooltip({
  active,
  payload,
  currency = 'AUD',
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenueReportDataPoint }>;
  currency?: string;
}) {
  if (!active || !payload?.length) return null;

  const dataPoint = payload[0].payload;
  const { date, amountCents } = dataPoint;
  const amount = (amountCents / 100).toFixed(2);

  return (
    <div className="rounded-lg border bg-background dark:bg-brand-dark-bg px-3 py-2 shadow-md">
      <p className="font-medium">{date}</p>
      <p className="text-sm text-muted-foreground">
        {amount} {currency}
      </p>
    </div>
  );
}

function getDeduplicatedEntities(data: RevenueReportDataPoint[]): RevenueReportDataPoint['entities'] {
  const seen = new Set<string>();
  const result: RevenueReportDataPoint['entities'] = [];
  for (const point of data) {
    for (const entity of point.entities) {
      if (!seen.has(entity.id)) {
        seen.add(entity.id);
        result.push(entity);
      }
    }
  }
  return result;
}

const CHART_PRIMARY = 'hsl(var(--primary))';

export function RevenueReportChart({
  data,
  title,
  barColor = CHART_PRIMARY,
  currency = 'AUD',
  onEntityClick,
  tableVariant,
}: RevenueReportChartProps & { tableVariant: ReportsEntitiesTableVariant }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const highlightColor = CHART_PRIMARY;

  const deduplicatedEntities = getDeduplicatedEntities(data);

  return (
    <div className="space-y-4">
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-AU', {
                  weekday: 'short',
                  day: 'numeric',
                });
              }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value: number) =>
                (value / 100).toLocaleString('en-AU', {
                  maximumFractionDigits: 0,
                })
              }
            />
            <Tooltip content={<RevenueTooltip currency={currency} />} />
            <Bar dataKey="amountCents" name={title} radius={[4, 4, 0, 0]}>
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
      <ReportsEntitiesTable
        entities={deduplicatedEntities}
        variant={tableVariant}
        onEntityClick={onEntityClick}
      />
    </div>
  );
}

