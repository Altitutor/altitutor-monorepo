'use client';

import { cn } from '../lib/cn';
import { Badge } from './badge';
import { Button } from './button';
import { CreditCard, Check, Trash2, Loader2 } from 'lucide-react';

export interface PaymentMethodCardData {
  id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
}

interface PaymentMethodCardProps {
  paymentMethod: PaymentMethodCardData;
  isDeleting?: boolean;
  onSetDefault?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
  className?: string;
}

function getCardBrandColor(brand: string): string {
  const brandMap: Record<string, string> = {
    visa: 'from-slate-700 to-slate-900',
    mastercard: 'from-slate-700 via-slate-800 to-slate-900',
    amex: 'from-slate-700 to-slate-900',
    discover: 'from-slate-700 to-slate-900',
    jcb: 'from-slate-700 to-slate-900',
    diners: 'from-slate-700 to-slate-900',
    unionpay: 'from-slate-700 to-slate-900',
  };
  return brandMap[brand.toLowerCase()] || 'from-slate-700 to-slate-900';
}

function getCardBrandName(brand: string): string {
  const brandMap: Record<string, string> = {
    visa: 'VISA',
    mastercard: 'Mastercard',
    amex: 'American Express',
    discover: 'Discover',
    jcb: 'JCB',
    diners: 'Diners Club',
    unionpay: 'UnionPay',
  };
  return brandMap[brand.toLowerCase()] || brand.toUpperCase();
}

function formatExpiryMonth(month: number): string {
  return month.toString().padStart(2, '0');
}

function formatExpiryYear(year: number): string {
  return year.toString().slice(-2);
}

export function PaymentMethodCard({
  paymentMethod,
  isDeleting = false,
  onSetDefault,
  onDelete,
  showActions = true,
  className,
}: PaymentMethodCardProps) {
  const gradient = getCardBrandColor(paymentMethod.card_brand);
  const brandName = getCardBrandName(paymentMethod.card_brand);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl shadow-lg transition-all duration-300',
        'flex flex-col',
        paymentMethod.is_default && !isDeleting && 'ring-2 ring-primary ring-offset-2',
        isDeleting && 'opacity-60',
        className
      )}
    >
      {/* Credit Card Design */}
      <div
        className={cn(
          'relative p-5 text-white flex flex-col justify-between',
          'bg-gradient-to-br',
          gradient,
          'aspect-[1.586/1]', // Credit card aspect ratio (85.60mm × 53.98mm)
        )}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <span className="text-xs font-medium opacity-90">{brandName}</span>
          </div>
          {paymentMethod.is_default && !isDeleting && (
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30 text-xs">
              <Check className="h-3 w-3 mr-1" />
              Default
            </Badge>
          )}
          {isDeleting && (
            <Badge variant="destructive" className="text-xs">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Deleting
            </Badge>
          )}
        </div>

        {/* Card Number */}
        <div className="mb-4 flex-1 flex items-center">
          <div className="w-full">
            <div className="text-[10px] text-white/60 mb-1.5 uppercase tracking-wider">Card Number</div>
            <div className="text-xl font-mono tracking-widest">
              •••• •••• •••• {paymentMethod.card_last4}
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-white/60 mb-0.5 uppercase tracking-wider">Expires</div>
            <div className="text-xs font-medium">
              {formatExpiryMonth(paymentMethod.card_exp_month)}/{formatExpiryYear(paymentMethod.card_exp_year)}
            </div>
          </div>
          <div className="text-2xl opacity-15 font-bold">••••</div>
        </div>

        {/* Decorative circles */}
        <div className="absolute top-3 right-3 w-12 h-12 rounded-full bg-white/8 -mr-6 -mt-6" />
        <div className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-white/8 -mr-4 -mb-4" />
      </div>

      {/* Actions Bar - Overlay on hover */}
      {showActions && !paymentMethod.is_default && !isDeleting && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-xl opacity-0 hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          {onSetDefault && (
            <Button
              variant="default"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault(paymentMethod.id);
              }}
            >
              Set Default
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(paymentMethod.id);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

