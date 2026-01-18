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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useQueryClient } from '@tanstack/react-query';
import { createSubsidy, type CreateSubsidyInput } from '../api/subsidies';
import { studentSubsidiesKeys } from './StudentBillingTab';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { subjectsApi } from '@/features/subjects/api/subjects';
import type { Tables } from '@altitutor/shared';
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
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Load subjects when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoadingSubjects(true);
      subjectsApi
        .getAllSubjects()
        .then(setAllSubjects)
        .catch((error) => {
          toast({
            title: 'Error',
            description: 'Failed to load subjects',
            variant: 'destructive',
          });
          console.error(error);
        })
        .finally(() => setLoadingSubjects(false));
    }
  }, [isOpen, toast]);

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Subsidy</DialogTitle>
          <DialogDescription>
            Create a new hourly rate subsidy for this student. The student will pay the minimum of the subsidy rate and the default rate for the selected subject and billing type.
          </DialogDescription>
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
            <Select value={billingType} onValueChange={(value) => setBillingType(value as 'CLASS' | 'EXAM_COURSE' | 'DRAFTING')}>
              <SelectTrigger id="billing-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLASS">CLASS</SelectItem>
                <SelectItem value="EXAM_COURSE">EXAM_COURSE</SelectItem>
                <SelectItem value="DRAFTING">DRAFTING</SelectItem>
              </SelectContent>
            </Select>
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
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger id="currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AUD">AUD</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
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

