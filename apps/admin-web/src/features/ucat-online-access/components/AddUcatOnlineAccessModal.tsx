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
  useToast,
} from '@altitutor/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { studentsApi } from '@/features/students/api/students';
import { manualOnlineAccessApi } from '@/features/ucat-online-access/api/ucat-online-access';
import { subjectsApi } from '@/features/subjects/api/subjects';
import { useCurrentStaff } from '@/shared/hooks';
import { cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

type AddUcatOnlineAccessModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onGranted: () => void;
};

export function AddUcatOnlineAccessModal({
  isOpen,
  onClose,
  onGranted,
}: AddUcatOnlineAccessModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const [selectedStudent, setSelectedStudent] = useState<Tables<'students'> | null>(null);
  const [subjectId, setSubjectId] = useState<string>('');
  const [notes, setNotes] = useState('');

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', 'all-for-manual-access'],
    queryFn: () => subjectsApi.getAllSubjects(),
    enabled: isOpen,
    staleTime: 60_000,
  });

  const sortedSubjects = [...subjects].sort((a, b) =>
    (a.name ?? '').localeCompare(b.name ?? ''),
  );

  const { data: searchResults = [], isFetching } = useQuery({
    queryKey: ['manual-online-access', 'student-search', debounced],
    queryFn: () =>
      studentsApi.searchStudents(debounced.trim(), ['ACTIVE', 'TRIAL', 'DISCONTINUED'], true),
    enabled: isOpen && debounced.trim().length >= 2,
    staleTime: 30_000,
  });

  const grantMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) throw new Error('Select a student');
      if (!subjectId) throw new Error('Select a subject');
      await manualOnlineAccessApi.grant({
        studentId: selectedStudent.id,
        subjectId,
        notes: notes.trim() || null,
        createdBy: currentStaff?.id ?? null,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Access granted',
        description: 'Manual online access has been recorded for this student and subject.',
      });
      queryClient.invalidateQueries({ queryKey: ['manual-online-access'] });
      onGranted();
      onClose();
      setSelectedStudent(null);
      setSearch('');
      setSubjectId('');
      setNotes('');
    },
    onError: (e: Error) => {
      toast({
        title: 'Could not grant access',
        description: e.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Grant manual online access</DialogTitle>
          <DialogDescription>
            Choose a student and subject. This grants manual online product access for that subject (in addition to
            class or subscription access when applicable).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="manual-access-student-search">Student</Label>
            <Input
              id="manual-access-student-search"
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
            <Label htmlFor="manual-access-subject">Subject</Label>
            <select
              id="manual-access-subject"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">Select a subject…</option>
              {sortedSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                  {sub.short_name ? ` (${sub.short_name})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="manual-access-notes">Notes (optional)</Label>
            <Input
              id="manual-access-notes"
              placeholder="Internal note"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedStudent || !subjectId || grantMutation.isPending}
            onClick={() => grantMutation.mutate()}
          >
            {grantMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Grant access'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
