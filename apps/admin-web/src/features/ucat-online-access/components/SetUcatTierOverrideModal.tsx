'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  useToast,
} from '@altitutor/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { studentsApi } from '@/features/students/api/students';
import {
  manualOnlineAccessApi,
  UCAT_TIER_OVERRIDE_LABELS,
  type UcatOnlineTierOverride,
} from '@/features/ucat-online-access/api/ucat-online-access';
import { cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

type SetUcatTierOverrideModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  initialStudent?: Tables<'students'> | null;
};

const TIER_OPTIONS: UcatOnlineTierOverride[] = [
  'default',
  'force_free',
  'force_unlimited',
];

function isTierOverride(value: string): value is UcatOnlineTierOverride {
  return (TIER_OPTIONS as readonly string[]).includes(value);
}

export function SetUcatTierOverrideModal({
  isOpen,
  onClose,
  onSaved,
  initialStudent = null,
}: SetUcatTierOverrideModalProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(initialStudent);
  const [tierOverride, setTierOverride] = useState<UcatOnlineTierOverride>('default');

  useEffect(() => {
    if (isOpen && initialStudent) {
      setSelectedStudent(initialStudent);
      setSearch(`${initialStudent.first_name ?? ''} ${initialStudent.last_name ?? ''}`.trim());
      const current = initialStudent.ucat_online_tier_override;
      if (isTierOverride(current)) setTierOverride(current);
    }
  }, [initialStudent, isOpen]);

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['manual-online-access', 'tier-override-student-search', debounced],
    queryFn: () =>
      studentsApi.searchStudents(debounced.trim(), ['ACTIVE', 'TRIAL', 'DISCONTINUED'], true),
    enabled: isOpen && !initialStudent && debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error('Select a student');
      await manualOnlineAccessApi.setUcatTierOverride(selectedStudent.id, tierOverride);
    },
    onSuccess: () => {
      toast({
        title: 'UCAT tier override updated',
        description: `${selectedStudent?.first_name ?? ''} ${selectedStudent?.last_name ?? ''} is now set to ${UCAT_TIER_OVERRIDE_LABELS[tierOverride]}.`,
      });
      onSaved();
      onClose();
      setSelectedStudent(initialStudent);
      setSearch(initialStudent ? `${initialStudent.first_name ?? ''} ${initialStudent.last_name ?? ''}`.trim() : '');
      setTierOverride('default');
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not update tier override',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <AdminDialogShell
      open={isOpen}
      onClose={onClose}
      title="Set UCAT tier override"
      subtitle="Override a student's UCAT online tier independently of Stripe subscriptions. Manual UCAT grants automatically set Force UCAT Unlimited; revoking the last UCAT grant resets to Default."
      contentClassName="md:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedStudent || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save override'
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {initialStudent ? (
          <div className="space-y-2">
            <Label>Student</Label>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
              {initialStudent.first_name} {initialStudent.last_name}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="tier-override-student-search">Student</Label>
            <Input
              id="tier-override-student-search"
              placeholder="Type at least 2 characters to search…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedStudent(null);
              }}
            />
            {selectedStudent ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="font-medium">
                  {selectedStudent.first_name} {selectedStudent.last_name}
                </span>
                <span className="text-muted-foreground"> · {selectedStudent.status}</span>
              </div>
            ) : debounced.trim().length >= 2 ? (
              <div className="max-h-48 overflow-auto rounded-md border">
                {isFetching ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No students found.</p>
                ) : (
                  searchResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center px-3 py-2 text-left text-sm hover:bg-muted',
                      )}
                      onClick={() => {
                        setSelectedStudent(s);
                        setSearch(`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim());
                      }}
                    >
                      <span className="font-medium">
                        {s.first_name} {s.last_name}
                      </span>
                      <span className="ml-2 text-muted-foreground">{s.status}</span>
                    </button>
                  ))
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Enter a name to search.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tier-override-value">Tier override</Label>
          <Select
            value={tierOverride}
            onValueChange={(v) => {
              if (isTierOverride(v)) setTierOverride(v);
            }}
          >
            <SelectTrigger id="tier-override-value">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {UCAT_TIER_OVERRIDE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </AdminDialogShell>
  );
}
