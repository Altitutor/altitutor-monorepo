'use client';

import React from 'react';
import { FileText, Calendar, CreditCard } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { formatDate } from '@/shared/utils/datetime';
import { cn } from '@/shared/utils';
import { Badge } from '@altitutor/ui';

interface InvoiceCardProps {
  invoice: Tables<'invoices'>;
  onClick?: () => void;
  className?: string;
}

export function InvoiceCard({
  invoice,
  onClick,
  className
}: InvoiceCardProps) {
  const amount = (invoice.total_cents || 0) / 100;
  const status = invoice.status || 'draft';

  const getStatusColor = (s: string) => {
    switch (s) {
      case 'paid': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'void': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
      case 'uncollectible': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    }
  };

  return (
    <div
      className={cn(
        'relative border rounded-lg transition-colors p-3 bg-card overflow-hidden',
        onClick ? 'hover:bg-muted/50 cursor-pointer' : '',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
          <FileText className="h-5 w-5 text-muted-foreground" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-sm truncate min-w-0 flex-1">
                  Invoice {invoice.stripe_invoice_number || invoice.id.slice(0, 8)}
                </h4>
                <Badge variant="outline" className={cn("text-[10px] h-4 px-1 capitalize font-normal shrink-0", getStatusColor(status))}>
                  {status}
                </Badge>
              </div>
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Created {formatDate(invoice.created_at || '')}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <CreditCard className="h-3 w-3" />
                  <span>${amount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
