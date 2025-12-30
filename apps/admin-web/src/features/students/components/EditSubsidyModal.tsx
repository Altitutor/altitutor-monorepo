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
import { updateSubsidy, type UpdateSubsidyInput, type StudentSubsidyRow } from '../api/subsidies';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { subjectsApi } from '@/features/subjects/api/subjects';
import type { Tables } from '@altitutor/shared';

interface EditSubsidyModalProps {
  isOpen: boolean;
  onClose: () => void;
  subsidy: StudentSubsidyRow;
  onSuccess: () => void;
}

export function EditSubsidyModal({ isOpen, onClose, subsidy, onSuccess }: EditSubsidyModalProps) {
  const [selectedSubject, setSelectedSubject] = useState<Tables<'subjects'> | null>(subsidy.subject);
  const [billingType, setBillingType] = useState<'CLASS' | 'EXAM_COURSE' | 'DRAFTING'>(
    subsidy.billing_type
  );
  const [priceDollars, setPriceDollars] = useState<string>((subsidy.price_cents / 100).toFixed(2));
  const [currency, setCurrency] = useState<string>(subsidy.currency);
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    subsidy.effective_from ? new Date(subsidy.effective_from).toISOString().split('T')[0] : ''
  );
  const [effectiveUntil, setEffectiveUntil] = useState<string>(
    subsidy.effective_until ? new Date(subsidy.effective_until).toISOString().split('T')[0] : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const { toast } = useToast();

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

  // Reset form when subsidy changes
  useEffect(() => {
    if (subsidy) {
      setSelectedSubject(subsidy.subject);
      setBillingType(subsidy.billing_type);
      setPriceDollars((subsidy.price_cents / 100).toFixed(2));
      setCurrency(subsidy.currency);
      setEffectiveFrom(
        subsidy.effective_from ? new Date(subsidy.effective_from).toISOString().split('T')[0] : ''
      );
      setEffectiveUntil(
        subsidy.effective_until ? new Date(subsidy.effective_until).toISOString().split('T')[0] : ''
      );
    }
  }, [subsidy]);

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
      const updates: UpdateSubsidyInput = {
        subject_id: selectedSubject.id,
        billing_type: billingType,
        price_cents: Math.round(parseFloat(priceDollars) * 100),
        currency,
        effective_from: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
        effective_until: effectiveUntil ? new Date(effectiveUntil).toISOString() : null,
      };

      await updateSubsidy(subsidy.id, updates);
      toast({
        title: 'Success',
        description: 'Subsidy updated successfully',
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update subsidy',
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
          <DialogTitle>Edit Subsidy</DialogTitle>
          <DialogDescription>
            Update the hourly rate subsidy details. The student will pay the minimum of the subsidy rate and the default rate. Leave "Effective Until" empty for indefinitely.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <SubjectSearchPopover
              allSubjects={allSubjects}
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
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

