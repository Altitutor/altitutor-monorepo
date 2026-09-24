import { METRIC_KEYS, getMetricValue } from '@altitutor/shared/pay-tiers';
import {
  getResourceMetricBreakdown,
  getSessionMetricBreakdown,
  type MetricBreakdown,
} from '../utils/payTierMetricBreakdowns';

const countFormatter = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 2 });

function formatCount(value: number): string {
  return countFormatter.format(value);
}

function UnavailableMetric() {
  return <span className="text-muted-foreground">Unavailable</span>;
}

export function TimeMetricCell({
  metrics,
  prefix,
}: {
  metrics: Record<string, number> | null;
  prefix: 'tenure' | 'time_since_promotion';
}) {
  if (!metrics) return <UnavailableMetric />;

  const daysKey = prefix === 'tenure' ? METRIC_KEYS.tenureDays : METRIC_KEYS.timeSincePromotionDays;
  const weeksKey = prefix === 'tenure' ? METRIC_KEYS.tenureWeeks : METRIC_KEYS.timeSincePromotionWeeks;
  const monthsKey = prefix === 'tenure' ? METRIC_KEYS.tenureMonths : METRIC_KEYS.timeSincePromotionMonths;

  return (
    <div className="min-w-32 space-y-1 text-xs">
      <div className="flex justify-between gap-4 font-medium text-foreground">
        <span>Total</span>
        <span>{formatCount(getMetricValue(metrics, daysKey))} days</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>Weeks</span>
        <span>{formatCount(getMetricValue(metrics, weeksKey))}</span>
      </div>
      <div className="flex justify-between gap-4 text-muted-foreground">
        <span>Months</span>
        <span>{formatCount(getMetricValue(metrics, monthsKey))}</span>
      </div>
    </div>
  );
}

function BreakdownCell({ breakdown }: { breakdown: MetricBreakdown }) {
  return (
    <div className="min-w-44 space-y-1 text-xs">
      <div className="flex justify-between gap-4 font-medium text-foreground">
        <span>Total</span>
        <span>{formatCount(breakdown.total)}</span>
      </div>
      {breakdown.items.map((item) => (
        <div key={item.key} className="flex justify-between gap-4 text-muted-foreground">
          <span>{item.label}</span>
          <span>{formatCount(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function SessionMetricCell({ metrics }: { metrics: Record<string, number> | null }) {
  if (!metrics) return <UnavailableMetric />;

  const breakdown = getSessionMetricBreakdown(metrics);
  return (
    <div className="min-w-48 space-y-1 text-xs">
      <div className="flex justify-between gap-4 font-medium text-foreground">
        <span>Total</span>
        <span>{formatCount(breakdown.total)}</span>
      </div>
      {breakdown.items.map((item) => (
        <div key={item.key}>
          <div className="flex justify-between gap-4 text-muted-foreground">
            <span>{item.label}</span>
            <span>{formatCount(item.value)}</span>
          </div>
          {item.attendance.map((attendance) => (
            <div
              key={attendance.key}
              className="flex justify-between gap-4 pl-3 text-muted-foreground/80"
            >
              <span>{attendance.label}</span>
              <span>{formatCount(attendance.value)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function ResourceMetricCell({ metrics }: { metrics: Record<string, number> | null }) {
  if (!metrics) return <UnavailableMetric />;
  return <BreakdownCell breakdown={getResourceMetricBreakdown(metrics)} />;
}
