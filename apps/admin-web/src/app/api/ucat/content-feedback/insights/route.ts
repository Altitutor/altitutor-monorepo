import { NextResponse } from 'next/server';
import { createClient } from '@/shared/lib/supabase/server-ssr';
import type { InsightFeedbackRow } from '@/features/ucat-content-feedback/types';

type RatingRow = {
  target_type: string;
  target_key: string;
  target_version: string;
  surface: string;
  vote: number;
  reason_code: string | null;
  reason_text: string | null;
  displayed_content: unknown;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const client = createClient();
  const { data: isAdmin, error: accessError } = await client.rpc('is_adminstaff_active');
  if (accessError) return NextResponse.json({ error: 'Could not verify admin access' }, { status: 500 });
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const ratings: RatingRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client
      .from('student_ucat_content_ratings')
      .select('target_type,target_key,target_version,surface,vote,reason_code,reason_text,displayed_content,created_at,updated_at')
      .neq('target_type', 'answer_explanation')
      .is('resolved_at', null)
      .order('updated_at', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const page = (data ?? []) as unknown as RatingRow[];
    ratings.push(...page);
    if (page.length < pageSize) break;
  }

  const groups = new Map<string, InsightFeedbackRow>();
  for (const rating of ratings) {
    const id = `${rating.target_type}:${rating.target_key}:${rating.target_version}`;
    const row: InsightFeedbackRow = groups.get(id) ?? {
      id,
      targetType: rating.target_type,
      targetKey: rating.target_key,
      targetVersion: rating.target_version,
      displayedContent: rating.displayed_content as Record<string, string>,
      upvotes: 0,
      downvotes: 0,
      totalVotes: 0,
      downvoteRate: 0,
      reasonCounts: {},
      surfaceCounts: {},
      comments: [],
      firstAt: rating.created_at,
      latestAt: rating.updated_at,
    };

    row.totalVotes += 1;
    if (rating.vote === 1) row.upvotes += 1;
    if (rating.vote === -1) row.downvotes += 1;
    if (rating.reason_code) row.reasonCounts[rating.reason_code] = (row.reasonCounts[rating.reason_code] ?? 0) + 1;
    row.surfaceCounts[rating.surface] = (row.surfaceCounts[rating.surface] ?? 0) + 1;
    if (rating.reason_text) {
      row.comments.push({ text: rating.reason_text, reasonCode: rating.reason_code, createdAt: rating.created_at });
    }
    if (rating.created_at < row.firstAt) row.firstAt = rating.created_at;
    if (rating.updated_at > row.latestAt) row.latestAt = rating.updated_at;
    groups.set(id, row);
  }

  const feedback = Array.from(groups.values())
    .map((row) => ({ ...row, downvoteRate: row.totalVotes === 0 ? 0 : row.downvotes / row.totalVotes }))
    .sort((left, right) => right.downvotes - left.downvotes || right.latestAt.localeCompare(left.latestAt));

  return NextResponse.json({ feedback });
}
