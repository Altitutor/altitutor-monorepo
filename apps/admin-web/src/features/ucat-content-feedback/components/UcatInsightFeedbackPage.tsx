'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { SettingsPageHeader } from '@/shared/components';
import type { InsightFeedbackRow } from '@/features/ucat-content-feedback/types';

const TYPE_LABELS: Record<string, string> = {
  question_insight: 'Question insight',
  attempt_insight: 'Attempt insight',
  progress_insight: 'Progress insight',
  dashboard_insight: 'Dashboard insight',
};

function contentText(row: InsightFeedbackRow) {
  return Object.values(row.displayedContent).filter(Boolean).join('\n');
}

export function UcatInsightFeedbackPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [surfaceFilter, setSurfaceFilter] = useState('all');
  const [search, setSearch] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'ucat', 'insight-feedback'],
    queryFn: async () => {
      const response = await fetch('/api/ucat/content-feedback/insights');
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? 'Could not load insight feedback');
      return (body.feedback ?? []) as InsightFeedbackRow[];
    },
  });

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (query.data ?? []).filter((row) => {
      if (typeFilter !== 'all' && row.targetType !== typeFilter) return false;
      if (surfaceFilter !== 'all' && !row.surfaceCounts[surfaceFilter]) return false;
      return !needle || `${row.targetKey} ${contentText(row)}`.toLowerCase().includes(needle);
    });
  }, [query.data, search, surfaceFilter, typeFilter]);

  const totals = useMemo(() => rows.reduce((result, row) => ({
    versions: result.versions + 1,
    votes: result.votes + row.totalVotes,
    downvotes: result.downvotes + row.downvotes,
    comments: result.comments + row.comments.length,
  }), { versions: 0, votes: 0, downvotes: 0, comments: 0 }), [rows]);

  return (
    <div className="space-y-6 p-6">
      <SettingsPageHeader title="UCAT insight feedback" />
      <p className="text-sm text-muted-foreground">Developer-facing feedback on the insight copy shown throughout UCAT Web.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries({ 'Insight versions': totals.versions, Votes: totals.votes, Downvotes: totals.downvotes, Comments: totals.comments }).map(([label, value]) => (
          <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{value}</CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search insight copy or key…" className="md:max-w-sm" />
        <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="md:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All insight types</SelectItem>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={surfaceFilter} onValueChange={setSurfaceFilter}><SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All surfaces</SelectItem><SelectItem value="dashboard">Dashboard</SelectItem><SelectItem value="progress">Progress</SelectItem><SelectItem value="attempt">Attempt</SelectItem></SelectContent></Select>
      </div>

      {query.isLoading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : query.isError ? (
        <Card className="border-destructive"><CardContent className="pt-6 text-destructive">{query.error instanceof Error ? query.error.message : 'Could not load insight feedback'}</CardContent></Card>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No insight feedback matches these filters.</CardContent></Card>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table><TableHeader><TableRow><TableHead>Insight</TableHead><TableHead>Surface</TableHead><TableHead>Votes</TableHead><TableHead>Reasons and comments</TableHead><TableHead>Latest</TableHead></TableRow></TableHeader>
            <TableBody>{rows.map((row) => (
              <TableRow key={row.id} className="align-top">
                <TableCell className="max-w-[420px]"><div className="font-medium">{TYPE_LABELS[row.targetType] ?? row.targetType}</div><div className="mt-1 whitespace-pre-wrap text-sm">{contentText(row)}</div><code className="mt-2 block break-all text-xs text-muted-foreground">{row.targetKey} · {row.targetVersion}</code></TableCell>
                <TableCell><div className="flex flex-wrap gap-1">{Object.entries(row.surfaceCounts).map(([surface, count]) => <Badge key={surface} variant="outline">{surface} {count}</Badge>)}</div></TableCell>
                <TableCell className="whitespace-nowrap"><div>{row.downvotes} down · {row.upvotes} up</div><div className="text-xs text-muted-foreground">{Math.round(row.downvoteRate * 100)}% down</div></TableCell>
                <TableCell className="max-w-[420px]"><div className="flex flex-wrap gap-1">{Object.entries(row.reasonCounts).map(([reason, count]) => <Badge key={reason} variant="secondary">{reason.replaceAll('_', ' ')} {count}</Badge>)}</div>{row.comments.length > 0 ? <details className="mt-2"><summary className="cursor-pointer text-sm font-medium">{row.comments.length} comment{row.comments.length === 1 ? '' : 's'}</summary><div className="mt-2 space-y-2">{row.comments.map((comment, index) => <blockquote key={`${comment.createdAt}-${index}`} className="border-l-2 pl-3 text-sm">{comment.text}<footer className="mt-1 text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</footer></blockquote>)}</div></details> : <div className="mt-2 text-sm text-muted-foreground">No written comments</div>}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{new Date(row.latestAt).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
