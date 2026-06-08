'use client';

import * as React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import type { Country } from 'react-phone-number-input';
import { cn } from '../lib/cn';
import { Button } from './button';
import { SearchableSelect } from './searchable-select';

export interface PhoneCountryOption {
  value?: string;
  label: string;
  divider?: boolean;
}

export interface PhoneCountryIconProps {
  country?: Country;
  label: string;
  aspectRatio?: number;
  'aria-hidden'?: boolean;
}

export interface PhoneCountrySelectProps {
  value?: Country;
  onChange: (country?: Country) => void;
  options: PhoneCountryOption[];
  disabled?: boolean;
  readOnly?: boolean;
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
  iconComponent?: React.ComponentType<PhoneCountryIconProps>;
  className?: string;
  'aria-label'?: string;
}

function isSameCountryValue(a?: string, b?: string): boolean {
  if (a === undefined || a === null) {
    return b === undefined || b === null;
  }
  return a === b;
}

/**
 * Searchable country picker for PhoneInput (replaces native <select>).
 * Implements react-phone-number-input's countrySelectComponent contract.
 */
export function PhoneCountrySelect({
  value,
  onChange,
  options,
  disabled = false,
  readOnly = false,
  onFocus,
  onBlur,
  iconComponent: Icon,
  className,
  'aria-label': ariaLabel,
}: PhoneCountrySelectProps) {
  const countryOptions = React.useMemo(
    () => options.filter((option): option is PhoneCountryOption => !option.divider),
    [options],
  );

  const selectedOption = React.useMemo(
    () => countryOptions.find((option) => isSameCountryValue(option.value, value)) ?? null,
    [countryOptions, value],
  );

  const handleValueChange = React.useCallback(
    (item: PhoneCountryOption | null) => {
      if (!item) return;
      onChange(item.value as Country | undefined);
    },
    [onChange],
  );

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      const syntheticEvent = {} as React.FocusEvent<HTMLElement>;
      if (open) {
        onFocus?.(syntheticEvent);
      } else {
        onBlur?.(syntheticEvent);
      }
    },
    [onFocus, onBlur],
  );

  const isDisabled = disabled || readOnly;
  const FlagIcon = Icon ?? (() => null);

  return (
    <div className={cn('PhoneInputCountry', className)} data-phone-country-select>
      <SearchableSelect<PhoneCountryOption>
        key={value ?? 'ZZ'}
        items={countryOptions}
        value={selectedOption}
        onValueChange={handleValueChange}
        getItemId={(item) => item.value ?? 'ZZ'}
        getItemLabel={(item) => item.label}
        getItemValue={(item) => item.label}
        disabled={isDisabled}
        searchPlaceholder="Search countries..."
        emptyMessage="No countries found."
        contentWidth="min(320px, 90vw)"
        align="start"
        onOpenChange={handleOpenChange}
        trigger={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={isDisabled}
            aria-label={ariaLabel}
            className="h-12 shrink-0 gap-1 rounded-md border border-input bg-background px-2 font-normal shadow-none"
          >
            <FlagIcon
              key={value ?? 'ZZ'}
              aria-hidden
              country={value}
              label={selectedOption?.label ?? ''}
            />
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
          </Button>
        }
        renderItem={(item, isSelected) => (
          <>
            <Check
              className={cn('h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
            />
            <FlagIcon
              aria-hidden
              country={item.value as Country | undefined}
              label={item.label}
            />
            <span className={cn('truncate', isSelected ? 'font-medium' : '')}>{item.label}</span>
          </>
        )}
      />
    </div>
  );
}
