'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Label,
  SearchableSelect,
  Input,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createSubsidy, type CreateSubsidyInput } from '../api/subsidies';
import { studentSubsidiesKeys } from './StudentBillingTab';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import type { Tables } from '@altitutor/shared';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { getErrorMessage } from '@/shared/utils';

interface AddSubsidyModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
}

export function AddSubsidyModal({ isOpen, onClose, studentId }: AddSubsidyModalProps) {
  const [selectedSubject, setSelectedSubject] = useState<Tables<'subjects'> | null>(null);
  const [billingType, setBillingType] = useState<'CLASS' | 'EXAM_COURSE' | 'DRAFTING'>('CLASS');
  const [priceDollars, setPriceDollars] = useState<string>('');
  const [currency, setCurrency] = useState<string>('AUD');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [effectiveUntil, setEffectiveUntil] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);
  const queryClient = useQueryClient();

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedSubject(null);
      setBillingType('CLASS');
      setPriceDollars('');
      setCurrency('AUD');
      setEffectiveFrom(new Date().toISOString().split('T')[0]);
      setEffectiveUntil('');
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!selectedSubject) {
      toast({
        title: 'Error',
        description: 'Please select a subject',
        variant: 'destructive',
      });
      return;
    }

    if (!priceDollars || parseFloat(priceDollars) < 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid hourly rate',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateSubsidyInput = {
        student_id: studentId,
        subject_id: selectedSubject.id,
        billing_type: billingType,
        price_cents: Math.round(parseFloat(priceDollars) * 100),
        currency,
        effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : new Date().toISOString(),
        effective_until: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      };

      await createSubsidy(input);
      toast({
        title: 'Success',
        description: 'Subsidy created successfully',
      });
      queryClient.invalidateQueries({ queryKey: studentSubsidiesKeys.student(studentId) });
      onClose();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to create subsidy',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'sm:max-w-[500px]',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Add Subsidy</DialogTitle>
              <DialogDescription>
                Create a new hourly rate subsidy for this student. The student will pay the minimum of the subsidy rate and the default rate for the selected subject and billing type.
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <SubjectSearchPopover
              selectedSubjects={selectedSubject ? [selectedSubject] : []}
              onSelectSubject={setSelectedSubject}
              trigger={
                <Button variant="outline" className="w-full justify-start">
                  {selectedSubject
                    ? `${selectedSubject.curriculum} ${selectedSubject.year_level ? `Year ${selectedSubject.year_level}` : ''} ${selectedSubject.name}`
                    : 'Select a subject'}
                </Button>
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing-type">Billing Type</Label>
            <SearchableSelect<{ value: string; label: string }>
              items={[
                { value: 'CLASS', label: 'CLASS' },
                { value: 'EXAM_COURSE', label: 'EXAM_COURSE' },
                { value: 'DRAFTING', label: 'DRAFTING' },
              ]}
              value={
                billingType
                  ? { value: billingType, label: billingType }
                  : null
              }
              onValueChange={(item) => setBillingType((item?.value ?? 'CLASS') as 'CLASS' | 'EXAM_COURSE' | 'DRAFTING')}
              getItemLabel={(o) => o.label}
              getItemId={(o) => o.value}
              placeholder="Select billing type"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Subsidy Price Per Hour (in dollars)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={priceDollars}
              onChange={(e) => setPriceDollars(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              The student will pay the minimum of this subsidy rate and the default hourly rate for this billing type.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
            <SearchableSelect<{ value: string; label: string }>
              items={[
                { value: 'AUD', label: 'AUD' },
                { value: 'USD', label: 'USD' },
              ]}
              value={currency ? { value: currency, label: currency } : null}
              onValueChange={(item) => setCurrency(item?.value ?? 'AUD')}
              getItemLabel={(o) => o.label}
              getItemId={(o) => o.value}
              placeholder="Select currency"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-from">Effective From</Label>
            <Input
              id="effective-from"
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="effective-until">Effective Until (optional - leave empty for indefinitely)</Label>
            <Input
              id="effective-until"
              type="date"
              value={effectiveUntil}
              onChange={(e) => setEffectiveUntil(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedSubject || !priceDollars}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Subsidy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

