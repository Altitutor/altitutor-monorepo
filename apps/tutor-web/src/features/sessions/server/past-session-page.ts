import { BUSINESS_TIMEZONE, pastSessionTypes, type PastSessionCursor, type PastSessionType } from '@altitutor/shared';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const dayOffset = new Intl.DateTimeFormat('en-AU', { timeZone: BUSINESS_TIMEZONE, timeZoneName: 'longOffset' });

function readDay(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value ? date : null;
}

function adelaideMidnight(day: Date) {
  // At this probe the Adelaide clock is still on the evening before midnight.
  const probe = new Date(+day - 12 * 60 * 60 * 1000);
  const zone = dayOffset.formatToParts(probe).find(({ type }) => type === 'timeZoneName')?.value;
  const offset = zone?.match(/^GMT([+-])(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!offset) throw new Error('Adelaide time offset is unavailable.');
  const [, sign, hours, minutes, seconds] = offset;
  const offsetSeconds = (sign === '-' ? -1 : 1) * (Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds ?? 0));
  return new Date(+day - offsetSeconds * 1000).toISOString();
}

export function readPastSessionRequest(params: URLSearchParams) {
  const before = params.get('before');
  const afterId = params.get('afterId');
  const search = (params.get('search') ?? '').trim();
  const requestedTypes = params.getAll('type');
  const subjectIds = params.getAll('subject');
  const studentIds = params.getAll('student');
  const staffIds = params.getAll('staff');
  const fromDay = params.get('from');
  const toDay = params.get('to');
  const from = readDay(fromDay);
  const to = readDay(toDay);
  const validType = (value: string): value is PastSessionType => pastSessionTypes.some((type) => type === value);
  const excludedTypes = ['STAFF_INTERVIEW', 'SUBSIDY_INTERVIEW'];
  if (search.length > 160 || requestedTypes.length > pastSessionTypes.length + excludedTypes.length ||
      !requestedTypes.every((type) => validType(type) || excludedTypes.includes(type)) ||
      [subjectIds, studentIds, staffIds].some((ids) => ids.length > 50 || !ids.every((id) => uuid.test(id))) ||
      (fromDay && !from) || (toDay && !to) || (from && to && from > to)) return null;
  if ((before || afterId) && (!before || !afterId || !uuid.test(afterId) ||
      !timestamp.test(before) || !Number.isFinite(Date.parse(before)))) return null;
  if (to) to.setUTCDate(to.getUTCDate() + 1);
  return {
    search, types: requestedTypes.filter(validType), requestedTypes: requestedTypes.length > 0, subjectIds, studentIds, staffIds,
    from: from ? adelaideMidnight(from) : null,
    until: to ? adelaideMidnight(to) : null,
    cursor: before && afterId ? { startAt: before, id: afterId } : null,
  };
}

const pageSize = 20;
const scanSize = 100;
const maxBatches = 5;

export async function collectPastSessionPage<T extends PastSessionCursor>(
  load: (cursor: PastSessionCursor | null, limit: number) => Promise<T[]>,
  matches: (row: T) => boolean,
  cursor: PastSessionCursor | null,
): Promise<{ rows: T[]; next: PastSessionCursor | null }> {
  const rows: T[] = [];
  let next = cursor;

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const batch = await load(next, scanSize);
    for (const [index, row] of batch.entries()) {
      next = { startAt: row.startAt, id: row.id };
      if (!matches(row)) continue;
      rows.push(row);
      if (rows.length === pageSize) {
        return { rows, next: index + 1 === batch.length && batch.length < scanSize ? null : next };
      }
    }
    if (batch.length < scanSize) return { rows, next: null };
  }

  return { rows, next };
}
