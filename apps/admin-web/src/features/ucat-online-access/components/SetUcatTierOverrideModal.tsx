'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
};

const TIER_OPTIONS: UcatOnlineTierOverride[] = [
  'default',
  'force_free',
  'force_unlimited',
  'force_pro',
];

function isTierOverride(value: string): value is UcatOnlineTierOverride {
  return (TIER_OPTIONS as readonly string[]).includes(value);
}

export function SetUcatTierOverrideModal({
  isOpen,
  onClose,
  onSaved,
}: SetUcatTierOverrideModalProps) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  const [tierOverride, setTierOverride] = useState<UcatOnlineTierOverride>('default');

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['manual-online-access', 'tier-override-student-search', debounced],
    queryFn: () =>
      studentsApi.searchStudents(debounced.trim(), ['ACTIVE', 'TRIAL', 'DISCONTINUED'], true),
    enabled: isOpen && debounced.trim().length >= 2,
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
      setSelectedStudent(null);
      setSearch('');
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set UCAT tier override</DialogTitle>
          <DialogDescription>
            Override a student&apos;s UCAT online tier independently of Stripe subscriptions. Manual UCAT
            grants automatically set Force UCAT Pro; revoking the last UCAT grant resets to Default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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

        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
