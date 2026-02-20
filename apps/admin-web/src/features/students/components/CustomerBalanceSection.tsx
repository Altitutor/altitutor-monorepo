'use client';

import { useState, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { getErrorMessage, formatSubjectDisplay } from '@/shared/utils';
import { Loader2, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { RadioGroup, RadioGroupItem } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useCurrentStaff } from '@/shared/hooks';
import type { Tables } from '@altitutor/shared';
import { calculateSessionPrice } from '@/shared/utils/pricing';
import { fetchStudentSubsidies } from '../api/subsidies';
import { pricingApi } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi } from '@/features/billing/api/subject-pricing-overrides';

interface CustomerBalanceData {
  balance_cents: number;
  currency: string;
  updated_at: string;
}

interface BalanceTransaction {
  id: string;
  amount_cents: number;
  currency: string;
  type: string;
  description: string | null;
  created: number;
  ending_balance: number;
  invoice_id: string | null;
  credit_note_id: string | null;
  metadata: Record<string, string>;
}

interface BalanceHistoryData {
  transactions: BalanceTransaction[];
  has_more: boolean;
  last_transaction_id: string | null;
}

interface SessionPriceOption {
  id: string;
  label: string;
  amount_cents: number;
  currency: string;
  subject_id: string;
  billing_type: string;
}

interface SelectedSession {
  id: string; // Unique ID for this instance
  optionId: string; // The session option ID
  label: string;
  amount_cents: number;
  currency: string;
}

interface CustomerBalanceSectionProps {
  studentId: string;
  studentName?: string; // Optional student name for display
}

/**
 * Calculate gross amount with credit card fees
 * Mirrors logic from supabase/functions/billing-runner/shared/utils.ts
 */
function grossUp(
  net: number,
  isInternational: boolean,
  percentDomestic: number,
  percentIntl: number,
  fixedCents: number
): number {
  const percent = isInternational ? percentIntl : percentDomestic;
  return Math.round((net + fixedCents) / (1 - percent));
}

export function CustomerBalanceSection({ studentId, studentName }: CustomerBalanceSectionProps) {
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<SelectedSession[]>([]);
  const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [nextSessionId, setNextSessionId] = useState(1);
  const [sessionSelectValue, setSessionSelectValue] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: currentStaff } = useCurrentStaff();

  // Fetch student enrolled classes with subjects
  const { data: studentClasses } = useQuery({
    queryKey: ['student-classes-for-balance', studentId],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('classes_students')
        .select(`
          class:classes(
            id,
            subject_id,
            start_time,
            end_time,
            subject:subjects(*)
          )
        `)
        .eq('student_id', studentId)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
        
      if (error) throw error;
      
      return (data || [])
        .map((row: any) => row.class)
        .filter((cls: any) => cls !== null && cls.subject !== null)
        .map((cls: any) => ({
          class_id: cls.id,
          subject: cls.subject as Tables<'subjects'>,
          start_time: cls.start_time,
          end_time: cls.end_time,
          billing_type: 'CLASS' as const, // Classes always use CLASS billing type
        }));
    },
    enabled: isAdjustModalOpen, // Only fetch when modal is open
  });

  // Fetch subsidies
  const { data: subsidies } = useQuery({
    queryKey: ['student-subsidies', studentId],
    queryFn: () => fetchStudentSubsidies(studentId),
    enabled: isAdjustModalOpen,
  });

  // Fetch pricing data
  const { data: billingPricing } = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: () => pricingApi.getBillingPricing(),
    enabled: isAdjustModalOpen,
  });

  const { data: pricingOverrides } = useQuery({
    queryKey: ['pricing-overrides'],
    queryFn: () => subjectPricingOverridesApi.getAllSubjectOverrides(),
    enabled: isAdjustModalOpen,
  });

  // Calculate session price options from enrolled classes
  const sessionPriceOptions = useMemo<SessionPriceOption[]>(() => {
    if (!studentClasses || !billingPricing || !subsidies || !pricingOverrides) {
      return [];
    }

    const options: SessionPriceOption[] = [];
    const targetDate = new Date();
    
    // Build pricing maps
    const pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }> = {};
    billingPricing.forEach((p) => {
      pricingByBillingType[p.billing_type] = {
        hourly_rate_cents: p.hourly_rate_cents,
        currency: p.currency.toLowerCase(),
      };
    });

    const overridesBySubjectAndBilling: Record<string, Record<string, any>> = {};
    pricingOverrides.forEach((override) => {
      if (!overridesBySubjectAndBilling[override.subject_id]) {
        overridesBySubjectAndBilling[override.subject_id] = {};
      }
      overridesBySubjectAndBilling[override.subject_id][override.billing_type] = {
        hourly_rate_cents: override.hourly_rate_cents,
        currency: override.currency.toLowerCase(),
      };
    });

    // Calculate price for each class (subject + billing type combination)
    studentClasses.forEach(({ subject, billing_type, class_id, start_time, end_time }) => {
      if (!billing_type || !subject || !start_time || !end_time) return;

      // Create session start and end times using the class's actual times
      // Format: YYYY-MM-DDTHH:MM:SS (Adelaide local time, will be parsed correctly)
      const dateStr = targetDate.toISOString().split('T')[0]; // Get YYYY-MM-DD
      const sessionStart = `${dateStr}T${start_time}:00`;
      const sessionEnd = `${dateStr}T${end_time}:00`;

      const session = {
        billing_type: billing_type,
        subject_id: subject.id,
        start_at: sessionStart,
        end_at: sessionEnd,
      };

      const priceResult = calculateSessionPrice(
        session,
        studentId,
        targetDate,
        pricingByBillingType,
        overridesBySubjectAndBilling,
        pricingOverrides,
        subsidies
      );

      // Always include the option, even if price is 0 (for free sessions)
      // Add credit card fee (assume domestic card for now)
      // Default fees: 1.75% domestic, 2.9% international, $0.30 fixed
      const feePercentDom = 0.0175;
      const feePercentIntl = 0.029;
      const feeFixedCents = 30;
      const isInternational = false; // Could be enhanced to check payment method country
      
      const grossCents = grossUp(
        priceResult.amount_cents,
        isInternational,
        feePercentDom,
        feePercentIntl,
        feeFixedCents
      );

      options.push({
        id: `${class_id}-${subject.id}-${billing_type}`,
        label: `${formatSubjectDisplay(subject)} (${billing_type})`,
        amount_cents: grossCents,
        currency: priceResult.currency,
        subject_id: subject.id,
        billing_type: billing_type,
      });
    });

    return options.sort((a, b) => a.label.localeCompare(b.label));
  }, [studentClasses, billingPricing, subsidies, pricingOverrides, studentId]);

  const { data: balanceData, isLoading, refetch } = useQuery<CustomerBalanceData>({
    queryKey: ['customer-balance', studentId],
    queryFn: async () => {
      const response = await fetch(`/api/students/${studentId}/customer-balance`);
      if (!response.ok) {
        throw new Error('Failed to fetch customer balance');
      }
      return response.json();
    },
    staleTime: 1000 * 60, // 1 minute
  });

  const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery<BalanceHistoryData>({
    queryKey: ['customer-balance-history', studentId],
    queryFn: async () => {
      const response = await fetch(`/api/students/${studentId}/customer-balance/history?limit=50`);
      if (!response.ok) {
        throw new Error('Failed to fetch balance history');
      }
      return response.json();
    },
    enabled: showHistory, // Only fetch when history is shown
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Calculate balance display values (must be before previewBalance)
  const balanceCents = balanceData?.balance_cents || 0;
  const currency = balanceData?.currency || 'aud';
  const isCredit = balanceCents < 0;
  const balanceDisplay = Math.abs(balanceCents) / 100;
  const formattedBalance = `${isCredit ? '-' : ''}$${balanceDisplay.toFixed(2)}`;

  // Generate description from selected sessions (for submission)
  const generatedDescription = useMemo(() => {
    if (selectedSessions.length === 0) return '';
    const sessionLabels = selectedSessions.map(s => s.label);
    return `Credit for ${sessionLabels.join(', ')}`;
  }, [selectedSessions]);

  // Calculate final description for submission
  const finalDescription = useMemo(() => {
    const manualDesc = adjustmentDescription.trim();
    if (!manualDesc) return '';
    
    if (generatedDescription) {
      return `${generatedDescription}. Reason: ${manualDesc}`;
    }
    return manualDesc;
  }, [generatedDescription, adjustmentDescription]);

  // Preview description includes staff name (matches what is sent to Stripe)
  const previewDescription = useMemo(() => {
    if (!finalDescription) return '';
    const staffName = currentStaff
      ? [currentStaff.first_name, currentStaff.last_name].filter(Boolean).join(' ').trim() || 'Staff'
      : 'Staff';
    return `${finalDescription}. Adjustment made by: ${staffName}`;
  }, [finalDescription, currentStaff]);

  // Calculate preview balance based on selected adjustment type
  const previewBalance = useMemo(() => {
    const currentBalance = balanceCents || 0;
    let adjustment = 0;
    
    if (selectedSessions.length > 0) {
      const totalCents = selectedSessions.reduce((sum, session) => sum + session.amount_cents, 0);
      adjustment = adjustmentType === 'credit' ? -totalCents : totalCents;
    } else if (adjustmentAmount && !isNaN(parseFloat(adjustmentAmount))) {
      const amountCents = Math.round(parseFloat(adjustmentAmount) * 100);
      adjustment = adjustmentType === 'credit' ? -amountCents : amountCents;
    }
    
    return currentBalance + adjustment;
  }, [balanceCents, selectedSessions, adjustmentAmount, adjustmentType]);

  // Calculate adjustment amount for preview message
  const previewAdjustment = useMemo(() => {
    let amountCents = 0;
    
    if (selectedSessions.length > 0) {
      amountCents = selectedSessions.reduce((sum, session) => sum + session.amount_cents, 0);
    } else if (adjustmentAmount && !isNaN(parseFloat(adjustmentAmount))) {
      amountCents = Math.round(parseFloat(adjustmentAmount) * 100);
    }
    
    return { amountCents };
  }, [selectedSessions, adjustmentAmount]);

  const handleAddSession = (optionId: string) => {
    const option = sessionPriceOptions.find((opt) => opt.id === optionId);
    if (!option) return;

    const newSession: SelectedSession = {
      id: `session-${nextSessionId}`,
      optionId: option.id,
      label: option.label,
      amount_cents: option.amount_cents,
      currency: option.currency,
    };

    setSelectedSessions([...selectedSessions, newSession]);
    setNextSessionId(nextSessionId + 1);
    setSessionSelectValue(''); // Reset select
  };

  const handleRemoveSession = (sessionId: string) => {
    setSelectedSessions(selectedSessions.filter(s => s.id !== sessionId));
  };

  const handleAdjustBalance = async () => {
    // Validate manual description is required
    if (!adjustmentDescription.trim()) {
      toast({
        title: 'Error',
        description: 'Reason is required',
        variant: 'destructive',
      });
      return;
    }

    let amountCents: number;
    
    // Use selected sessions if any, otherwise use manual amount
    if (selectedSessions.length > 0) {
      amountCents = selectedSessions.reduce((sum, session) => sum + session.amount_cents, 0);
    } else {
      const amount = parseFloat(adjustmentAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: 'Error',
          description: 'Please enter a valid amount or select session options',
          variant: 'destructive',
        });
        return;
      }
      amountCents = Math.round(amount * 100);
    }

    setIsAdjusting(true);
    try {
      // Negative amount = credit (customer owes less), positive = debit (customer owes more)
      const isCredit = adjustmentType === 'credit';
      const adjustmentCents = isCredit ? -amountCents : amountCents;
      const currency = selectedSessions.length > 0 
        ? selectedSessions[0].currency 
        : balanceData?.currency || 'aud';

      const response = await fetch(`/api/students/${studentId}/customer-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount_cents: adjustmentCents,
          currency: currency.toLowerCase(),
          description: finalDescription,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to adjust balance');
      }

      toast({
        title: 'Success',
        description: `Balance ${isCredit ? 'credited' : 'debited'} successfully`,
      });

      setIsAdjustModalOpen(false);
      setAdjustmentAmount('');
      setAdjustmentDescription('');
      setSelectedSessions([]);
      setAdjustmentType('credit'); // Reset to credit
      setNextSessionId(1);
      setSessionSelectValue('');
      await refetch();
      await refetchHistory();
      queryClient.invalidateQueries({ queryKey: ['customer-balance', studentId] });
      queryClient.invalidateQueries({ queryKey: ['customer-balance-history', studentId] });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to adjust balance',
        variant: 'destructive',
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleRefresh = async () => {
    await refetch();
    toast({
      title: 'Refreshed',
      description: 'Customer balance updated',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Customer Balance</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setIsAdjustModalOpen(true)} size="sm">
            Adjust Balance
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Current Balance</div>
              <div className={`text-2xl font-bold ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                {formattedBalance} {currency.toUpperCase()}
              </div>
              {balanceData?.updated_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Updated {new Date(balanceData.updated_at).toLocaleString()}
                </div>
              )}
            </div>
            {isCredit && (
              <div className="rounded-full bg-green-100 dark:bg-green-900/20 px-3 py-1">
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  Credit Available
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            {isCredit ? (
              <p>
                This customer has a credit balance. Credits will be automatically applied to future invoices.
              </p>
            ) : balanceCents === 0 ? (
              <p>No balance. Customer will be charged normally for invoices.</p>
            ) : (
              <p>
                This customer has a positive balance. They owe this amount.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Balance History Section */}
      <div className="rounded-lg border">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        >
          <h4 className="font-semibold">Balance History</h4>
          {showHistory ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showHistory && (
          <div className="border-t p-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : historyData?.transactions && historyData.transactions.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground mb-4">
                  Showing {historyData.transactions.length} transaction{historyData.transactions.length !== 1 ? 's' : ''}
                </div>
                <div className="overflow-x-auto -mx-4 px-4">
                  <table className="w-full text-sm">
                    <colgroup>
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '15%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">Type</th>
                        <th className="text-left p-2 font-medium">Description</th>
                        <th className="text-right p-2 font-medium">Amount</th>
                        <th className="text-right p-2 font-medium">Ending Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.transactions.map((tx) => {
                        const isCredit = tx.amount_cents < 0;
                        const amountDisplay = Math.abs(tx.amount_cents) / 100;
                        const endingBalanceDisplay = Math.abs(tx.ending_balance) / 100;
                        const endingIsCredit = tx.ending_balance < 0;

                        // Map transaction types to readable labels
                        const typeLabels: Record<string, string> = {
                          adjustment: 'Manual Adjustment',
                          applied_to_invoice: 'Applied to Invoice',
                          credit_note: 'Credit Note',
                          invoice_too_small: 'Invoice Too Small',
                          invoice_too_large: 'Invoice Too Large',
                          unapplied_from_invoice: 'Unapplied from Invoice',
                          unspent_receiver_credit: 'Unspent Receiver Credit',
                          initial: 'Initial Balance',
                        };

                        return (
                          <tr key={tx.id} className="border-b hover:bg-muted/50">
                            <td className="p-2">
                              {new Date(tx.created * 1000).toLocaleString()}
                            </td>
                            <td className="p-2">
                              <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-muted">
                                {typeLabels[tx.type] || tx.type}
                              </span>
                            </td>
                            <td className="p-2">
                              <div className="break-words whitespace-normal" title={tx.description || undefined}>
                                {tx.description || '-'}
                              </div>
                              {tx.invoice_id && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Invoice: {tx.invoice_id}
                                </div>
                              )}
                              {tx.credit_note_id && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Credit Note: {tx.credit_note_id}
                                </div>
                              )}
                            </td>
                            <td className={`p-2 text-right font-medium whitespace-nowrap ${isCredit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {isCredit ? '+' : '-'}${amountDisplay.toFixed(2)} {tx.currency.toUpperCase()}
                            </td>
                            <td className={`p-2 text-right whitespace-nowrap ${endingIsCredit ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                              {endingIsCredit ? '-' : ''}${endingBalanceDisplay.toFixed(2)} {tx.currency.toUpperCase()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {historyData.has_more && (
                  <div className="text-sm text-muted-foreground mt-4 text-center">
                    More transactions available. Showing most recent 50.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No balance transactions found.
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={isAdjustModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAdjustModalOpen(false);
          setAdjustmentAmount('');
          setAdjustmentDescription('');
          setSelectedSessions([]);
          setAdjustmentType('credit');
          setNextSessionId(1);
          setSessionSelectValue('');
        } else {
          setIsAdjustModalOpen(true);
        }
      }}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
          {/* Header */}
          <div className="flex-shrink-0 border-b bg-background">
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setIsAdjustModalOpen(false);
                      setAdjustmentAmount('');
                      setAdjustmentDescription('');
                      setSelectedSessions([]);
                      setAdjustmentType('credit');
                      setNextSessionId(1);
                      setSessionSelectValue('');
                    }}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <DialogTitle>Adjust Customer Balance</DialogTitle>
                    <DialogDescription>
                      Credits will be automatically applied to future invoices.
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </DialogHeader>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full overflow-y-auto">
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: Options */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="session-option">Select Session(s)</Label>
                      <Select
                        value={sessionSelectValue}
                        onValueChange={(value) => {
                          if (value && value !== 'none') {
                            handleAddSession(value);
                          }
                        }}
                        disabled={isAdjusting}
                      >
                        <SelectTrigger id="session-option">
                          <SelectValue placeholder="Select a session to add" />
                        </SelectTrigger>
                        <SelectContent>
                          {sessionPriceOptions.length > 0 ? (
                            sessionPriceOptions.map((option) => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label} - ${(option.amount_cents / 100).toFixed(2)} {option.currency.toUpperCase()}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="none" disabled>
                              No session options available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Custom Amount - only show when no sessions selected */}
                    {selectedSessions.length === 0 && (
                      <div className="space-y-2">
                        <Label htmlFor="amount">Custom Amount ({currency.toUpperCase()})</Label>
                        <Input
                          id="amount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          placeholder="0.00"
                          value={adjustmentAmount}
                          onChange={(e) => {
                            setAdjustmentAmount(e.target.value);
                            if (e.target.value) {
                              setSelectedSessions([]); // Clear sessions when manually entering amount
                            }
                          }}
                          disabled={isAdjusting}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        Reason <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="description"
                        type="text"
                        placeholder="e.g., Refund for cancelled session"
                        value={adjustmentDescription}
                        onChange={(e) => setAdjustmentDescription(e.target.value)}
                        disabled={isAdjusting}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Adjustment Type</Label>
                      <RadioGroup
                        value={adjustmentType}
                        onValueChange={(value) => setAdjustmentType(value as 'credit' | 'debit')}
                        disabled={isAdjusting}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="credit" id="credit" />
                          <Label htmlFor="credit" className="font-normal cursor-pointer">
                            Credit (give the student money)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="debit" id="debit" />
                          <Label htmlFor="debit" className="font-normal cursor-pointer">
                            Debit (charge the student money)
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>

                  {/* Right Column: Preview */}
                  <div className="space-y-4">
                    {/* Selected Sessions Table */}
                    {selectedSessions.length > 0 && (
                      <div className="space-y-2">
                        <Label>Selected Sessions</Label>
                        <div className="border rounded-md">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left p-2 font-medium">Session</th>
                                  <th className="text-right p-2 font-medium">Amount</th>
                                  <th className="w-[40px] p-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedSessions.map((session) => (
                                  <tr key={session.id} className="border-b hover:bg-muted/50">
                                    <td className="p-2">{session.label}</td>
                                    <td className="p-2 text-right font-medium">
                                      ${(session.amount_cents / 100).toFixed(2)} {session.currency.toUpperCase()}
                                    </td>
                                    <td className="p-2">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveSession(session.id)}
                                        disabled={isAdjusting}
                                        className="h-8 w-8"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t bg-muted/30">
                                  <td className="p-2 font-medium">Total</td>
                                  <td className="p-2 text-right font-semibold">
                                    ${(selectedSessions.reduce((sum, s) => sum + s.amount_cents, 0) / 100).toFixed(2)} {selectedSessions[0]?.currency.toUpperCase() || currency.toUpperCase()}
                                  </td>
                                  <td className="p-2"></td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md bg-muted p-4 text-sm">
                      <div className="space-y-3">
                        {/* Current Balance */}
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Current Balance</span>
                          <span className="font-semibold">{formattedBalance} {currency.toUpperCase()}</span>
                        </div>

                        {/* Adjustment */}
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-muted-foreground">Adjustment</div>
                            {previewDescription && (
                              <div className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                                {previewDescription}
                              </div>
                            )}
                          </div>
                          <span className={`font-semibold ${previewAdjustment.amountCents > 0 ? (adjustmentType === 'credit' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-muted-foreground'}`}>
                            {previewAdjustment.amountCents > 0 
                              ? `${adjustmentType === 'credit' ? '+' : '-'}$${(previewAdjustment.amountCents / 100).toFixed(2)} ${currency.toUpperCase()}`
                              : `$0.00 ${currency.toUpperCase()}`
                            }
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">New Balance</span>
                            <span className="text-lg font-semibold">
                              {(() => {
                                const isNewCredit = previewBalance < 0;
                                const displayBalance = Math.abs(previewBalance) / 100;
                                return `${isNewCredit ? '-' : ''}$${displayBalance.toFixed(2)} ${currency.toUpperCase()}`;
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-between px-6 py-4 border-t bg-background">
            <Button
              variant="outline"
              onClick={() => {
                setIsAdjustModalOpen(false);
                setAdjustmentAmount('');
                setAdjustmentDescription('');
                setSelectedSessions([]);
                setAdjustmentType('credit');
                setNextSessionId(1);
                setSessionSelectValue('');
              }}
              disabled={isAdjusting}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={handleAdjustBalance}
              disabled={isAdjusting || (!adjustmentAmount && selectedSessions.length === 0) || !adjustmentDescription.trim()}
            >
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
