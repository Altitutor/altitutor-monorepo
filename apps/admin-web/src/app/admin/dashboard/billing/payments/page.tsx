'use client';

import { useEffect, useMemo, useState } from 'react';
import { billingApi, type PaymentRow } from '@/features/billing';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';

export default function PaymentsPage() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'ALL' | PaymentRow['status']>('ALL');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await billingApi.listPayments({ status, q, from, to });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => rows, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payments</h1>
        <div className="flex items-center gap-2">
          <Input placeholder="Search id/session" value={q} onChange={e => setQ(e.target.value)} />
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="succeeded">Succeeded</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
          <Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} />
          <Input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} />
          <Button variant="outline" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Student</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.created_at ? new Date(p.created_at as unknown as string).toLocaleString() : '-'}</TableCell>
                <TableCell className="font-mono text-xs">{p.session_id}</TableCell>
                <TableCell className="font-mono text-xs">{p.student_id}</TableCell>
                <TableCell>{`$${(p.amount_cents/100).toFixed(2)} ${p.currency}`}</TableCell>
                <TableCell>{p.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}


