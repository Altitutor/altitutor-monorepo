'use client';

import { Input } from '@altitutor/ui';
import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Standardizes Australian phone numbers to E.164 format (+61XXXXXXXXX)
 * Handles various input formats:
 * - 0478778288 -> +61478778288
 * - 478778288 -> +61478778288
 * - +61478778288 -> +61478778288
 * - +610478778288 -> +61478778288
 * - 61478778288 -> +61478778288
 */
export function standardizeAUPhone(input: string): string {
  if (!input) return '';
  
  // Remove all non-digit characters except +
  const cleaned = input.replace(/[^0-9+]/g, '');
  
  // Handle different formats
  if (cleaned.match(/^\+61[1-9][0-9]{8}$/)) {
    // Already correct: +61XXXXXXXXX
    return cleaned;
  } else if (cleaned.match(/^\+610[1-9][0-9]{8}$/)) {
    // Erroneous leading 0: +610XXXXXXXXX -> +61XXXXXXXXX
    return '+61' + cleaned.substring(4);
  } else if (cleaned.match(/^61[1-9][0-9]{8}$/)) {
    // Missing +: 61XXXXXXXXX -> +61XXXXXXXXX
    return '+' + cleaned;
  } else if (cleaned.match(/^610[1-9][0-9]{8}$/)) {
    // Missing + with leading 0: 610XXXXXXXXX -> +61XXXXXXXXX
    return '+61' + cleaned.substring(3);
  } else if (cleaned.match(/^0[1-9][0-9]{8}$/)) {
    // Australian format: 0XXXXXXXXX -> +61XXXXXXXXX
    return '+61' + cleaned.substring(1);
  } else if (cleaned.match(/^[1-9][0-9]{8}$/)) {
    // Just the number: XXXXXXXXX -> +61XXXXXXXXX
    return '+61' + cleaned;
  }
  
  // Return as-is if doesn't match any pattern
  return cleaned;
}

/**
 * Formats phone number for display with spaces
 * +61478778288 -> +61 478 778 288
 */
export function formatPhoneDisplay(phone: string): string {
  if (!phone) return '';
  
  const cleaned = phone.replace(/[^0-9+]/g, '');
  
  if (cleaned.startsWith('+61') && cleaned.length === 12) {
    return `+61 ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  
  return phone;
}

/**
 * Validates E.164 format for Australian mobiles
 */
export function validateAUPhone(phone: string): { valid: boolean; error?: string } {
  if (!phone) {
    return { valid: true }; // Empty is valid (optional field)
  }
  
  const standardized = standardizeAUPhone(phone);
  
  if (!standardized.match(/^\+61[1-9][0-9]{8}$/)) {
    return {
      valid: false,
      error: 'Invalid Australian mobile number. Must be 9 digits starting with 4 (e.g., 0478 778 288)'
    };
  }
  
  return { valid: true };
}

export function PhoneInput({ value = '', onChange, placeholder = '0478 778 288', disabled, className }: PhoneInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [error, setError] = useState<string>();

  // Initialize display value
  useEffect(() => {
    if (value) {
      setDisplayValue(formatPhoneDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setDisplayValue(input);
    
    // Clear error when user types
    if (error) setError(undefined);
  };

  const handleBlur = () => {
    if (!displayValue.trim()) {
      onChange?.('');
      setDisplayValue('');
      return;
    }

    // Standardize and validate
    const standardized = standardizeAUPhone(displayValue);
    const validation = validateAUPhone(standardized);
    
    if (!validation.valid) {
      setError(validation.error);
      return;
    }
    
    // Update with standardized value
    onChange?.(standardized);
    setDisplayValue(formatPhoneDisplay(standardized));
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          type="tel"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          aria-invalid={!!error}
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
          Enter Australian mobile number (e.g., 0478 778 288)
        </p>
      )}
    </div>
  );
}

