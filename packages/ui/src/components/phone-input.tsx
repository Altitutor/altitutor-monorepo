'use client';

import * as React from 'react';
import PhoneInputLib from 'react-phone-number-input';
import type { Country, Value as PhoneValue } from 'react-phone-number-input';
import { cn } from '../lib/cn';
import { Info } from 'lucide-react';
import 'react-phone-number-input/style.css';

export interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string;
  defaultCountry?: Country;
  international?: boolean;
}

/**
 * PhoneInput component for international phone numbers
 * Defaults to Australia (+61) but allows country selection
 */
export function PhoneInput({
  value = '',
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  defaultCountry = 'AU',
  international = true,
}: PhoneInputProps) {
  const handleChange = (phoneValue: PhoneValue) => {
    onChange?.(phoneValue || '');
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative">
        <PhoneInputLib
          international={international}
          defaultCountry={defaultCountry}
          value={value as PhoneValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            'phone-input-wrapper',
            '[&_.PhoneInputInput]:flex [&_.PhoneInputInput]:h-10 [&_.PhoneInputInput]:w-full [&_.PhoneInputInput]:rounded-md [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-input [&_.PhoneInputInput]:bg-background [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:py-2 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:ring-offset-background [&_.PhoneInputInput]:placeholder:text-muted-foreground [&_.PhoneInputInput]:focus-visible:outline-none [&_.PhoneInputInput]:focus-visible:ring-2 [&_.PhoneInputInput]:focus-visible:ring-ring [&_.PhoneInputInput]:focus-visible:ring-offset-2 [&_.PhoneInputInput]:disabled:cursor-not-allowed [&_.PhoneInputInput]:disabled:opacity-50',
            error && '[&_.PhoneInputInput]:border-destructive [&_.PhoneInputInput]:focus-visible:ring-destructive',
            '[&_.PhoneInputCountryIcon]:border-0 [&_.PhoneInputCountryIcon]:bg-transparent',
            '[&_.PhoneInputCountrySelect]:h-10 [&_.PhoneInputCountrySelect]:rounded-md [&_.PhoneInputCountrySelect]:border [&_.PhoneInputCountrySelect]:border-input [&_.PhoneInputCountrySelect]:bg-background [&_.PhoneInputCountrySelect]:px-2 [&_.PhoneInputCountrySelect]:pr-8 [&_.PhoneInputCountrySelect]:text-sm [&_.PhoneInputCountrySelect]:ring-offset-background [&_.PhoneInputCountrySelect]:focus:outline-none [&_.PhoneInputCountrySelect]:focus:ring-2 [&_.PhoneInputCountrySelect]:focus:ring-ring [&_.PhoneInputCountrySelect]:focus:ring-offset-2 [&_.PhoneInputCountrySelect]:disabled:cursor-not-allowed [&_.PhoneInputCountrySelect]:disabled:opacity-50',
            '[&_.PhoneInputCountrySelectArrow]:opacity-50 [&_.PhoneInputCountrySelectArrow]:absolute [&_.PhoneInputCountrySelectArrow]:right-2 [&_.PhoneInputCountrySelectArrow]:top-1/2 [&_.PhoneInputCountrySelectArrow]:-translate-y-1/2'
          )}
          numberInputProps={{
            className: cn(
              error && 'border-destructive focus-visible:ring-destructive'
            ),
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-start gap-1">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {!error && !disabled && (
        <p className="text-xs text-muted-foreground">
          Enter phone number with country code
        </p>
      )}
    </div>
  );
}

