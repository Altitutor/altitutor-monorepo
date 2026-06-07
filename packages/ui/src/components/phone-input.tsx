'use client';

import * as React from 'react';
import PhoneInputLib from 'react-phone-number-input';
import type { Country, Value as PhoneValue } from 'react-phone-number-input';
import { cn } from '../lib/cn';
import { Info } from 'lucide-react';
import { PhoneCountrySelect } from './phone-country-select';
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
  countries?: Country[];
  countrySelectClassName?: string;
}

const phoneFieldClassName = cn(
  'phone-input-wrapper flex items-center gap-2',
  '[&_.PhoneInputInput]:flex [&_.PhoneInputInput]:h-12 [&_.PhoneInputInput]:min-w-0 [&_.PhoneInputInput]:flex-1 [&_.PhoneInputInput]:rounded-md [&_.PhoneInputInput]:border [&_.PhoneInputInput]:border-input [&_.PhoneInputInput]:bg-background [&_.PhoneInputInput]:px-3 [&_.PhoneInputInput]:py-2 [&_.PhoneInputInput]:text-sm [&_.PhoneInputInput]:ring-offset-background [&_.PhoneInputInput]:placeholder:text-muted-foreground [&_.PhoneInputInput]:focus-visible:outline-none [&_.PhoneInputInput]:focus-visible:ring-2 [&_.PhoneInputInput]:focus-visible:ring-ring [&_.PhoneInputInput]:focus-visible:ring-offset-2 [&_.PhoneInputInput]:disabled:cursor-not-allowed [&_.PhoneInputInput]:disabled:opacity-50',
);

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
  countries,
  countrySelectClassName,
}: PhoneInputProps) {
  const handleChange = (phoneValue: PhoneValue) => {
    onChange?.(phoneValue || '');
  };

  const handleNumberKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      // Spaces in an empty/partial international field reset the country to defaultCountry.
      if (event.key === ' ') {
        event.preventDefault();
      }
    },
    [],
  );

  return (
    <div className={cn('space-y-1', className)}>
      <div className="relative">
        <PhoneInputLib
          international={international}
          defaultCountry={defaultCountry}
          countries={countries}
          addInternationalOption={false}
          countryCallingCodeEditable
          smartCaret={false}
          countrySelectComponent={PhoneCountrySelect}
          countrySelectProps={{ className: countrySelectClassName }}
          value={value as PhoneValue}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            phoneFieldClassName,
            error && '[&_.PhoneInputInput]:border-destructive [&_.PhoneInputInput]:focus-visible:ring-destructive',
          )}
          numberInputProps={{
            className: cn(error && 'border-destructive focus-visible:ring-destructive'),
            onKeyDown: handleNumberKeyDown,
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
