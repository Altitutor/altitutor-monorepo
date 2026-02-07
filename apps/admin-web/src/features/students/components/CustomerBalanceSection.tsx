'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { getErrorMessage } from '@/shared/utils';
import { Loader2, Plus, Minus, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';

interface CustomerBalanceData {
  balance_cents: number;
  currency: string;
  updated_at: string;
}

interface CustomerBalanceSectionProps {
  studentId: string;
}

export function CustomerBalanceSection({ studentId }: CustomerBalanceSectionProps) {
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentDescription, setAdjustmentDescription] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const handleAdjustBalance = async (isCredit: boolean) => {
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }

    setIsAdjusting(true);
    try {
      // Negative amount = credit (customer owes less), positive = debit (customer owes more)
      const amountCents = Math.round(amount * 100);
      const adjustmentCents = isCredit ? -amountCents : amountCents;

      const response = await fetch(`/api/students/${studentId}/customer-balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount_cents: adjustmentCents,
          currency: balanceData?.currency || 'aud',
          description: adjustmentDescription || `${isCredit ? 'Credit' : 'Debit'} adjustment`,
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
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['customer-balance', studentId] });
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

  const balanceCents = balanceData?.balance_cents || 0;
  const currency = balanceData?.currency || 'aud';
  const isCredit = balanceCents < 0;
  const balanceDisplay = Math.abs(balanceCents) / 100;
  const formattedBalance = `${isCredit ? '-' : ''}$${balanceDisplay.toFixed(2)}`;

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

      <Dialog open={isAdjustModalOpen} onOpenChange={setIsAdjustModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Customer Balance</DialogTitle>
            <DialogDescription>
              Add credit (negative balance) or debit (positive balance) to this customer's account.
              Credits will be automatically applied to future invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({currency.toUpperCase()})</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={adjustmentAmount}
                onChange={(e) => setAdjustmentAmount(e.target.value)}
                disabled={isAdjusting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                type="text"
                placeholder="e.g., Refund for cancelled session"
                value={adjustmentDescription}
                onChange={(e) => setAdjustmentDescription(e.target.value)}
                disabled={isAdjusting}
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="font-medium mb-1">Current Balance:</div>
              <div className="text-lg font-semibold">{formattedBalance} {currency.toUpperCase()}</div>
              {adjustmentAmount && !isNaN(parseFloat(adjustmentAmount)) && (
                <>
                  <div className="mt-2 pt-2 border-t">
                    <div className="font-medium mb-1">After Adjustment:</div>
                    <div className="text-lg font-semibold">
                      {(() => {
                        const adjustment = parseFloat(adjustmentAmount) * 100;
                        const newBalance = balanceCents - adjustment; // Negative adjustment = credit
                        const isNewCredit = newBalance < 0;
                        const displayBalance = Math.abs(newBalance) / 100;
                        return `${isNewCredit ? '-' : ''}$${displayBalance.toFixed(2)} ${currency.toUpperCase()}`;
                      })()}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsAdjustModalOpen(false)}
              disabled={isAdjusting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => handleAdjustBalance(true)}
              disabled={isAdjusting || !adjustmentAmount}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Credit
            </Button>
            <Button
              variant="default"
              onClick={() => handleAdjustBalance(false)}
              disabled={isAdjusting || !adjustmentAmount}
              className="w-full sm:w-auto"
            >
              <Minus className="mr-2 h-4 w-4" />
              Add Debit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
