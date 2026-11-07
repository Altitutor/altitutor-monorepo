import { pastSessionTypes, type PastSessionCursor, type PastSessionType } from '@altitutor/shared';

import { adelaideMidnight, readCalendarDay } from '@/shared/utils/datetime';

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

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
  const from = readCalendarDay(fromDay);
  const to = readCalendarDay(toDay);
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
