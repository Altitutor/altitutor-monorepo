'use client';

import { useState } from 'react';
import { Card, CardContent, Button, Badge, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@altitutor/ui';
import { CreditCard, Trash2, Check, Loader2 } from 'lucide-react';
import { useSetDefaultPaymentMethod, useDeletePaymentMethod } from '../hooks/usePaymentMethods';
import type { PaymentMethodData } from '../api/payment-methods';
import { cn } from '@/shared/utils';

interface PaymentMethodsListProps {
  paymentMethods: PaymentMethodData[];
}

function getCardBrandIcon(brand: string): string {
  const brandMap: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    discover: '💳',
    unknown: '💳',
  };
  return brandMap[brand.toLowerCase()] || '💳';
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

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {paymentMethods.map((method) => {
          const deleting = isDeleting(method.id);
          
          return (
            <Card 
              key={method.id} 
              className={cn(
                'transition-all duration-300',
                method.is_default && !deleting && 'border-brand-500',
                deleting && 'border-destructive bg-destructive/5 border-2'
              )}
            >
              <CardContent className={cn('p-4', deleting && 'opacity-75')}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      'p-2 rounded-lg transition-colors',
                      deleting ? 'bg-destructive/20' : 'bg-muted'
                    )}>
                      {deleting ? (
                        <Loader2 className="h-5 w-5 animate-spin text-destructive" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={cn(
                          'font-medium',
                          deleting && 'text-destructive'
                        )}>
                          {method.card_brand.toUpperCase()} •••• {method.card_last4}
                        </p>
                        {method.is_default && !deleting && (
                          <Badge variant="default" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Default
                          </Badge>
                        )}
                        {deleting && (
                          <Badge variant="destructive" className="text-xs">
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            Deleting...
                          </Badge>
                        )}
                      </div>
                      <p className={cn(
                        'text-sm',
                        deleting ? 'text-destructive/70' : 'text-muted-foreground'
                      )}>
                        Expires {method.card_exp_month}/{method.card_exp_year}
                      </p>
                      {method.card_country && (
                        <p className={cn(
                          'text-xs',
                          deleting ? 'text-destructive/60' : 'text-muted-foreground'
                        )}>
                          {method.card_country}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {!method.is_default && !deleting && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSetDefault(method.id)}
                          disabled={setDefaultMutation.isPending}
                        >
                          Set Default
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(method.id)}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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








