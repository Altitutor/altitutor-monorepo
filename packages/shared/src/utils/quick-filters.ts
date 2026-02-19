import { 
  format,
  addDays, 
  subDays, 
  startOfWeek, 
  endOfWeek
} from 'date-fns';
import { QuickFilterConfig } from '../types/quick-filters';

/**
 * Resolves dynamic placeholders in a quick filter configuration.
 * 
 * Supported placeholders:
 * - $ME$: Current user's ID
 * - Date placeholders resolve to YYYY-MM-DD values for from/to keys
 */
export function resolveQuickFilterPlaceholders(
  config: QuickFilterConfig,
  currentUserId?: string
): QuickFilterConfig {
  const resolved: QuickFilterConfig = {};
  const now = new Date();
  const mondayThisWeek = startOfWeek(now, { weekStartsOn: 1 });
  const sundayThisWeek = endOfWeek(now, { weekStartsOn: 1 });

  const formatDate = (date: Date) => format(date, 'yyyy-MM-dd');
  const isFromKey = (key: string) => key.toLowerCase() === 'from' || key.toLowerCase().endsWith('_from');
  const isToKey = (key: string) => key.toLowerCase() === 'to' || key.toLowerCase().endsWith('_to');

  for (const [key, values] of Object.entries(config)) {
    resolved[key] = values.map((val) => {
      if (typeof val !== 'string') return val;

      switch (val) {
        case '$ME$':
          return currentUserId || val;
        case '$TODAY$':
          return formatDate(now);
        case '$TOMORROW$':
          return formatDate(addDays(now, 1));
        case '$YESTERDAY$':
          return formatDate(subDays(now, 1));
        case '$FUTURE$':
          return isFromKey(key) ? formatDate(now) : val;
        case '$PAST$':
          return isToKey(key) ? formatDate(now) : val;
        case '$THIS_WEEK$':
          return isToKey(key) ? formatDate(sundayThisWeek) : formatDate(mondayThisWeek);
        case '$MONDAY_THIS_WEEK$':
          return formatDate(mondayThisWeek);
        case '$SUNDAY_THIS_WEEK$':
          return formatDate(sundayThisWeek);
        default:
          return val;
      }
    });
  }

  return resolved;
}
