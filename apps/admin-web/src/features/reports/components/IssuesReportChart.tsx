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
import { ReportsEntitiesTable, type ReportsEntitiesTableVariant } from './ReportsEntitiesTable';

type ReportEntity = ReportDataPoint['entities'][number];

const IRREGULAR_PLURALS: Record<string, string> = {
  class: 'classes',
};

function pluralize(singular: string, count: number): string {
  if (count === 1) return singular;
  return IRREGULAR_PLURALS[singular] ?? `${singular}s`;
}

interface IssuesReportChartProps {
  data: ReportDataPoint[];
  title: string;
  barColor?: string;
  /**
   * Singular label for the entity being counted (e.g. "issue", "student").
   * Defaults to "issue".
   */
  entityLabelSingular?: string;
  /**
   * Called when an entity is clicked. Entity is clickable when this is provided and entity has a link.
   */
  onEntityClick?: (entity: ReportEntity) => void;
}

const CHART_PRIMARY = 'hsl(var(--primary))';

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
  const pluralized = pluralize(entityLabelSingular, count);

  return (
    <div className="rounded-lg border bg-background dark:bg-brand-dark-bg px-3 py-2 shadow-md">
      <p className="font-medium">{date}</p>
      <p className="text-sm text-muted-foreground">
        {count} {pluralized}
      </p>
    </div>
  );
}

function getDeduplicatedEntities(data: ReportDataPoint[]): ReportDataPoint['entities'] {
  const seen = new Set<string>();
  const result: ReportDataPoint['entities'] = [];
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

export function IssuesReportChart({
  data,
  title,
  barColor = CHART_PRIMARY,
  entityLabelSingular = 'issue',
  onEntityClick,
  tableVariant,
}: IssuesReportChartProps & { tableVariant: ReportsEntitiesTableVariant }) {
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
                return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
              }}
            />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip content={<CustomTooltip entityLabelSingular={entityLabelSingular} />} />
            <Bar dataKey="count" name={title} radius={[4, 4, 0, 0]}>
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
