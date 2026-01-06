'use client';

import { useState } from 'react';
import { PaymentMethodCard, type PaymentMethodCardData } from '@altitutor/ui';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@altitutor/ui';
import { useSetDefaultPaymentMethod, useDeletePaymentMethod } from '../hooks/usePaymentMethods';
import type { PaymentMethodData } from '../api/payment-methods';

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethodData[];
}

export function PaymentMethodsList({ paymentMethods }: PaymentMethodsListProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const setDefaultMutation = useSetDefaultPaymentMethod();
  const deleteMutation = useDeletePaymentMethod();

  const handleSetDefault = (paymentMethodId: string) => {
    setDefaultMutation.mutate(paymentMethodId);
  };

  const handleDeleteClick = (paymentMethodId: string) => {
    setDeleteConfirmId(paymentMethodId);
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmId) {
      deleteMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (!paymentMethods || paymentMethods.length === 0) {
    return null;
  }

  const isDeleting = (paymentMethodId: string) => {
    return deleteMutation.isPending && deleteMutation.variables === paymentMethodId;
  };

  const mapToCardData = (method: PaymentMethodData): PaymentMethodCardData => ({
    id: method.id,
    card_brand: method.card_brand,
    card_last4: method.card_last4,
    card_exp_month: method.card_exp_month,
    card_exp_year: method.card_exp_year,
    is_default: method.is_default,
  });

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {paymentMethods.map((method) => {
          const deleting = isDeleting(method.id);
          
          return (
            <PaymentMethodCard
              key={method.id}
              paymentMethod={mapToCardData(method)}
              isDeleting={deleting}
              onSetDefault={handleSetDefault}
              onDelete={handleDeleteClick}
              showActions={true}
            />
          );
        })}
      </div>

      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment method? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}








