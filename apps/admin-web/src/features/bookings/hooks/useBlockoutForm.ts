import { useState, useCallback } from 'react';
import { useToast } from '@altitutor/ui';
import { blockoutsApi, type BlockoutRow, type CreateBlockoutInput, type UpdateBlockoutInput } from '../api/blockouts';
import { dateToAdelaideMidnightUTC, dateToAdelaideEndOfDayUTC, utcToAdelaideDate, getTodayAdelaideDate } from '../utils/dateTimeHelpers';

export interface UseBlockoutFormOptions {
  onSuccess?: () => void;
}

export interface BlockoutFormState {
  staffId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

/**
 * Hook for managing blockout form state and operations
 */
export function useBlockoutForm({ onSuccess }: UseBlockoutFormOptions = {}) {
  const { toast } = useToast();
  const [staffId, setStaffId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(getTodayAdelaideDate);
  const [endDate, setEndDate] = useState<string>(getTodayAdelaideDate);
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setStaffId('');
    setStartDate(getTodayAdelaideDate());
    setEndDate(getTodayAdelaideDate());
    setReason('');
  }, []);

  const loadBlockout = useCallback((blockout: BlockoutRow) => {
    setStaffId(blockout.staff_id);
    setStartDate(utcToAdelaideDate(blockout.start_at));
    setEndDate(utcToAdelaideDate(blockout.end_at));
    setReason(blockout.reason || '');
  }, []);

  const validateForm = useCallback((): string | null => {
    if (!staffId) {
      return 'Please select a staff member';
    }
    if (endDate < startDate) {
      return 'End date must be on or after start date';
    }
    return null;
  }, [staffId, startDate, endDate]);

  const createBlockout = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const input: CreateBlockoutInput = {
        staff_id: staffId,
        start_at: dateToAdelaideMidnightUTC(startDate),
        end_at: dateToAdelaideEndOfDayUTC(endDate),
        reason: reason || undefined,
      };
      await blockoutsApi.createBlockout(input);
      resetForm();
      onSuccess?.();
      toast({
        title: 'Success',
        description: 'Blockout created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create blockout',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [staffId, startDate, endDate, reason, validateForm, resetForm, onSuccess, toast]);

  const updateBlockout = useCallback(async (blockoutId: string) => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: 'Validation Error',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const updates: UpdateBlockoutInput = {
        start_at: dateToAdelaideMidnightUTC(startDate),
        end_at: dateToAdelaideEndOfDayUTC(endDate),
        reason: reason || undefined,
      };
      await blockoutsApi.updateBlockout(blockoutId, updates);
      resetForm();
      onSuccess?.();
      toast({
        title: 'Success',
        description: 'Blockout updated successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update blockout',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setSaving(false);
    }
  }, [startDate, endDate, reason, validateForm, resetForm, onSuccess, toast]);

  const deleteBlockout = useCallback(async (blockoutId: string) => {
    if (!confirm('Are you sure you want to delete this blockout?')) return;
    
    setDeleting(blockoutId);
    try {
      await blockoutsApi.deleteBlockout(blockoutId);
      onSuccess?.();
      toast({
        title: 'Success',
        description: 'Blockout deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete blockout',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  }, [onSuccess, toast]);

  return {
    // State
    staffId,
    startDate,
    endDate,
    reason,
    saving,
    deleting,
    
    // Setters
    setStaffId,
    setStartDate,
    setEndDate,
    setReason,
    
    // Actions
    resetForm,
    loadBlockout,
    createBlockout,
    updateBlockout,
    deleteBlockout,
    validateForm,
  };
}
