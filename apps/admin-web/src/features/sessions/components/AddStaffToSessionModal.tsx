'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  AlertDescription,
  Button,
  Input,
} from '@altitutor/ui';
import { Loader2, Search, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { staffApi } from '@/features/staff/api/staff';
import { cn } from '@/shared/utils';
import { StaffCard } from '@/shared/components/StaffCard';
import { AdminDialogShell } from '@/shared/components';
import { useDialogHotkeys } from '@/shared/hooks';

type AddStaffToSessionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  sessionTime: string;
  sessionDay: string;
  existingStaffIds: string[];
  isPending?: boolean;
  onConfirm: (staff: Tables<'staff'>) => Promise<void>;
};

export function AddStaffToSessionModal({
  isOpen,
  onClose,
  sessionTitle,
  sessionTime,
  sessionDay,
  existingStaffIds,
  isPending = false,
  onConfirm,
}: AddStaffToSessionModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['add-staff-to-session', isOpen, search],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search,
        statuses: ['ACTIVE', 'TRIAL'],
        limit: 50,
        offset: 0,
        orderBy: 'first_name',
        ascending: true,
      });
      return result.staff as Tables<'staff'>[];
    },
    enabled: isOpen,
    staleTime: 1000 * 30,
  });

  const selectableStaff = useMemo(() => {
    const excluded = new Set(existingStaffIds);
    return staff.filter((s) => !excluded.has(s.id));
  }, [staff, existingStaffIds]);

  const selectedStaff = useMemo(
    () => selectableStaff.find((s) => s.id === selectedStaffId) || null,
    [selectableStaff, selectedStaffId]
  );

  const staffName = selectedStaff
    ? `${selectedStaff.first_name || ''} ${selectedStaff.last_name || ''}`.trim()
    : 'choose staff';

  const handleClose = useCallback(() => {
    setStep(1);
    setSearch('');
    setSelectedStaffId(null);
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!selectedStaff) return;
    try {
      await onConfirm(selectedStaff);
      handleClose();
    } catch {
      // Keep modal open if mutation fails so user can retry.
    }
  }, [handleClose, onConfirm, selectedStaff]);

  const hasNextStep = step === 1;

  const handleNextStep = useCallback(() => {
    if (step === 1 && selectedStaff) {
      setStep(2);
    }
  }, [step, selectedStaff]);

  useDialogHotkeys({
    isOpen,
    onNextStep: handleNextStep,
    hasNextStep,
    onPrimaryAction: step === 2 ? handleConfirm : undefined,
    isActionDisabled: isPending,
  });

  const warningText = selectedStaff
    ? `${staffName} will only be added to a single session on ${sessionTime} ${sessionDay}, they will not be assigned to the class`
    : '';

  return (
    <AdminDialogShell
      fillHeight
      open={isOpen}
      onClose={handleClose}
      title="Add Staff to Session"
      subtitle={`Step ${step} of 2: ${step === 1 ? 'Select Staff' : 'Confirm'}`}
      contentClassName="md:max-w-3xl"
      headerExtra={
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  'flex-1 h-2 rounded-full transition-colors',
                  s < step ? 'bg-primary' : s === step ? 'bg-primary/50' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </div>
      }
      footer={
        <div className="flex w-full justify-between">
          <Button variant="outline" onClick={() => (step === 1 ? handleClose() : setStep(1))}>
            {step === 1 ? (
              'Cancel'
            ) : (
              <span className="inline-flex items-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </span>
            )}
          </Button>

          {step === 1 ? (
            <Button onClick={() => setStep(2)} disabled={!selectedStaff}>
              <span className="inline-flex items-center gap-2">
                Next
                <ChevronRight className="h-4 w-4" />
              </span>
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isPending || !selectedStaff}>
              {isPending ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </span>
              ) : (
                'Confirm Add Staff'
              )}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium">
            Add{' '}
            <span
              className={cn(
                'inline-flex items-center px-2 py-1 rounded-md font-semibold border',
                selectedStaff
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20'
              )}
            >
              {staffName}
            </span>{' '}
            to{' '}
            <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-primary/10 text-primary border-primary/20">
              {sessionTitle}
            </span>
          </p>
        </div>

        {step === 1 && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search staff..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : selectableStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No staff available to add
              </p>
            ) : (
              <div className="space-y-2">
                {selectableStaff.map((staffMember) => (
                  <StaffCard
                    key={staffMember.id}
                    staff={staffMember}
                    subjects={[]}
                    showSubjects={false}
                    showActions={false}
                    isSelecting
                    isSelected={selectedStaffId === staffMember.id}
                    onClick={() => setSelectedStaffId(staffMember.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{warningText}</AlertDescription>
          </Alert>
        )}
      </div>
    </AdminDialogShell>
  );
}
