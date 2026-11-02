'use client';

import * as React from 'react';
import { getCountries, getCountryCallingCode, type Country } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import labels from 'react-phone-number-input/locale/en.json';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Info } from 'lucide-react';
import { cn } from '../lib/cn';
import { PhoneCountrySelect } from './phone-country-select';
import { Input } from './input';
import 'react-phone-number-input/style.css';

export interface PhoneInputProps {
  id?: string;
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

function displayNumber(value: string, country: Country, international: boolean) {
  const parsed = parsePhoneNumberFromString(value, country);
  return parsed?.isPossible()
    ? international ? parsed.formatInternational() : parsed.formatNational()
    : value;
}

/** Keep text edits intact; infer country and format only after leaving the number field. */
export function PhoneInput({
  id, value = '', onChange, placeholder, disabled = false, className, error,
  defaultCountry = 'AU', international = true, countries, countrySelectClassName,
}: PhoneInputProps) {
  const [country, setCountry] = React.useState<Country>(() =>
    parsePhoneNumberFromString(value, defaultCountry)?.country ?? defaultCountry);
  const [draft, setDraft] = React.useState(() => displayNumber(value, defaultCountry, international));
  const lastEmitted = React.useRef(value);
  React.useEffect(() => {
    // A controlled parent's echo must not overwrite a partially edited calling code.
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    const nextCountry = parsePhoneNumberFromString(value, defaultCountry)?.country ?? defaultCountry;
    setCountry(nextCountry);
    setDraft(displayNumber(value, nextCountry, international));
  }, [value, defaultCountry, international]);

  const emit = (text: string, selectedCountry: Country) => {
    const parsed = parsePhoneNumberFromString(text, selectedCountry);
    const nextValue = parsed?.isPossible() ? parsed.number : text.trim();
    lastEmitted.current = nextValue;
    onChange?.(nextValue);
  };
  const options = React.useMemo(() => (countries ?? getCountries()).map(code => ({
    value: code, label: `${labels[code]} +${getCountryCallingCode(code)}`,
  })), [countries]);

  return (
    <div className={cn('space-y-1', className)}>
      <div className="phone-input-wrapper flex items-center gap-2">
        <PhoneCountrySelect
          value={country}
          options={options}
          disabled={disabled}
          className={countrySelectClassName}
          aria-label="Phone number country"
          iconComponent={({ country: code }) => {
            const Flag = code ? flags[code] : undefined;
            return Flag ? <span className="PhoneInputCountryIcon"><Flag title={labels[code!]} /></span> : null;
          }}
          onChange={nextCountry => {
            if (!nextCountry) return;
            const parsed = parsePhoneNumberFromString(draft, country);
            const next = parsed
              ? `+${getCountryCallingCode(nextCountry)}${parsed.nationalNumber}`
              : draft ? draft : '';
            setCountry(nextCountry);
            setDraft(displayNumber(next, nextCountry, international));
            emit(next, nextCountry);
          }}
        />
        <Input
          id={id}
          type="tel"
          autoComplete="tel"
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          className={cn('PhoneInputInput h-12 min-w-0 flex-1', error && 'border-destructive focus-visible:ring-destructive')}
          onChange={event => {
            const text = event.target.value;
            setDraft(text);
            // Keep form state current for Enter-to-submit, without changing visible text.
            emit(text, country);
          }}
          onBlur={() => {
            const parsed = parsePhoneNumberFromString(draft, country);
            if (parsed?.country && (!countries || countries.includes(parsed.country))) setCountry(parsed.country);
            setDraft(displayNumber(draft, country, international));
            emit(draft, country);
          }}
        />
      </div>
      {error && <p className="text-sm text-destructive flex items-start gap-1"><Info className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span></p>}
    </div>
  );
}
