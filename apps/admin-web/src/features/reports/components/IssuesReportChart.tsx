'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
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

function EntityDisplay({
  entity,
  onClick,
}: {
  entity: ReportEntity;
  onClick?: (entity: ReportEntity) => void;
}) {
  const isClickable = !!onClick && (!!entity.link || entity.id);

  const content = <span className="truncate">{entity.name ?? ''}</span>;

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(entity)}
        className="w-full text-left text-sm text-brand-darkBlue hover:underline dark:text-brand-lightBlue truncate"
        title={entity.name}
      >
        {content}
      </button>
    );
  }

  return (
    <p className="text-sm truncate" title={entity.name}>
      {content}
    </p>
  );
}

export function IssuesReportChart({
  data,
  title,
  barColor = CHART_PRIMARY,
  entityLabelSingular = 'issue',
  onEntityClick,
}: IssuesReportChartProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const highlightColor = CHART_PRIMARY;

  const deduplicatedEntities = getDeduplicatedEntities(data);
  const aggregateCount = deduplicatedEntities.length;
  const pluralized = pluralize(entityLabelSingular, aggregateCount);

  return (
    <div className="flex gap-4">
      <div className="h-[280px] flex-1 min-w-0">
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
      <Card className="w-64 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-bold">{aggregateCount}</p>
          <p className="text-xs text-muted-foreground">
            {aggregateCount} {pluralized} in range
          </p>
          {deduplicatedEntities.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {deduplicatedEntities.map((entity) => (
                <EntityDisplay
                  key={entity.id}
                  entity={entity}
                  onClick={onEntityClick}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
