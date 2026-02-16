import { 
  startOfDay, 
  endOfDay, 
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek, 
  formatISO 
} from 'date-fns';
import { QuickFilterConfig } from '../types/quick-filters';

/**
 * Resolves dynamic placeholders in a quick filter configuration.
 * 
 * Supported placeholders:
 * - $ME$: Current user's ID
 * - $TODAY$: Range from start to end of today
 * - $TOMORROW$: Range from start to end of tomorrow
 * - $YESTERDAY$: Range from start to end of yesterday
 * - $FUTURE$: Range starting from now
 * - $PAST$: Range ending at now
 * - $THIS_WEEK$: Range from start of this week (Monday) to end of week (Sunday)
 */
export function resolveQuickFilterPlaceholders(
  config: QuickFilterConfig,
  currentUserId?: string
): QuickFilterConfig {
  const resolved: QuickFilterConfig = {};
  const now = new Date();

  for (const [key, values] of Object.entries(config)) {
    resolved[key] = values.map((val) => {
      if (typeof val !== 'string') return val;

      switch (val) {
        case '$ME$':
          return currentUserId || val;
        case '$TODAY$':
          return {
            start: formatISO(startOfDay(now)),
            end: formatISO(endOfDay(now)),
            type: 'date_range'
          };
        case '$TOMORROW$':
          return {
            start: formatISO(startOfDay(addDays(now, 1))),
            end: formatISO(endOfDay(addDays(now, 1))),
            type: 'date_range'
          };
        case '$YESTERDAY$':
          return {
            start: formatISO(startOfDay(subDays(now, 1))),
            end: formatISO(endOfDay(subDays(now, 1))),
            type: 'date_range'
          };
        case '$FUTURE$':
          return {
            start: formatISO(now),
            operator: 'gte',
            type: 'date_range'
          };
        case '$PAST$':
          return {
            end: formatISO(now),
            operator: 'lte',
            type: 'date_range'
          };
        case '$THIS_WEEK$':
          return {
            start: formatISO(startOfWeek(now, { weekStartsOn: 1 })), // Monday
            end: formatISO(endOfWeek(now, { weekStartsOn: 1 })),     // Sunday
            type: 'date_range'
          };
        default:
          return val;
      }
    });
  }

  return resolved;
}
