'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, useToast,
} from '@altitutor/ui';
import { invalidateInvoiceReconciliationSurfaces } from '@/shared/lib/query-invalidation';

export function DeleteVoidInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/billing/soft-delete-void-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        throw new Error(details?.error ?? 'Could not delete the voided invoice.');
      }
    },
    onSuccess: () => {
      void invalidateInvoiceReconciliationSurfaces(queryClient);
      setOpen(false);
      toast({ title: 'Voided invoice deleted' });
    },
    onError: (error) => toast({ title: error.message, variant: 'destructive' }),
  });

  return <span onClick={(event) => event.stopPropagation()}>
    <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>Delete void invoice</Button>
    <AlertDialog open={open} onOpenChange={(next) => !remove.isPending && setOpen(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this voided invoice?</AlertDialogTitle>
          <AlertDialogDescription>This removes the voided invoice from active billing records.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={remove.isPending} onClick={(event) => {
            event.preventDefault();
            remove.mutate();
          }}>{remove.isPending ? 'Deleting…' : 'Delete void invoice'}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </span>;
}
