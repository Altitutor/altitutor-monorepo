'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@altitutor/ui';
import type { Tables } from '@altitutor/shared';
import { Loader2, Plus, Shield } from 'lucide-react';
import {
  manualOnlineAccessApi,
  UCAT_TIER_OVERRIDE_LABELS,
} from '@/features/ucat-online-access/api/ucat-online-access';
import { AddUcatOnlineAccessModal } from '@/features/ucat-online-access/components/AddUcatOnlineAccessModal';
import { SetUcatTierOverrideModal } from '@/features/ucat-online-access/components/SetUcatTierOverrideModal';
import { SettingsTableActions } from '@/shared/components';
import { invalidateStudentDetail } from '@/shared/lib/query-invalidation';

interface StudentManualOnlineAccessProps {
  student: Tables<'students'>;
}

export function StudentManualOnlineAccess({ student }: StudentManualOnlineAccessProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [grantOpen, setGrantOpen] = useState(false);
  const [tierOpen, setTierOpen] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const queryKey = ['manual-online-access', 'student', student.id] as const;
  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => manualOnlineAccessApi.listByStudent(student.id),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      invalidateStudentDetail(queryClient, student.id),
    ]);
  };
  const revokeMutation = useMutation({
    mutationFn: (id: string) => manualOnlineAccessApi.revoke(id),
    onSuccess: () => {
      toast({ title: 'Access removed' });
      setRevokeId(null);
      void refresh();
    },
    onError: (error: Error) => {
      toast({ title: 'Could not remove access', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Manual access</h3>
          <p className="text-sm text-muted-foreground">
            UCAT tier: {UCAT_TIER_OVERRIDE_LABELS[student.ucat_online_tier_override as keyof typeof UCAT_TIER_OVERRIDE_LABELS] ?? student.ucat_online_tier_override}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTierOpen(true)}>
            <Shield className="mr-2 h-4 w-4" /> Set UCAT tier
          </Button>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Grant access
          </Button>
        </div>
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subject</TableHead>
              <TableHead>Granted</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="w-14" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading manual access…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No manual access grants.</TableCell></TableRow>
            ) : rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.subject?.long_name ?? row.subject?.name ?? 'Unknown subject'}</TableCell>
                <TableCell>{format(new Date(row.created_at), 'd MMM yyyy')}</TableCell>
                <TableCell className="text-muted-foreground">{row.notes ?? '—'}</TableCell>
                <TableCell>
                  <SettingsTableActions
                    className="flex justify-end"
                    actions={[{
                      id: 'remove-access',
                      label: 'Remove access',
                      destructive: true,
                      onSelect: () => setRevokeId(row.id),
                    }]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AddUcatOnlineAccessModal
        isOpen={grantOpen}
        onClose={() => setGrantOpen(false)}
        onGranted={() => void refresh()}
        initialStudent={student}
      />
      <SetUcatTierOverrideModal
        isOpen={tierOpen}
        onClose={() => setTierOpen(false)}
        onSaved={() => void refresh()}
        initialStudent={student}
      />
      <AlertDialog open={revokeId !== null} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove manual online access?</AlertDialogTitle>
            <AlertDialogDescription>
              Subscription or class-based access may still remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => revokeId && revokeMutation.mutate(revokeId)}
            >
              {revokeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
