'use client';

import { forwardRef } from 'react';
import { Input, type InputProps } from '@altitutor/ui';

/** Email address entry for AdminWeb, including addresses copied from mail links. */
export const EmailInput = forwardRef<HTMLInputElement, InputProps>(function EmailInput(
  {onChange, ...props}, ref,
) {
  return <Input {...props} ref={ref} type="email" onChange={event => {
    const value = event.currentTarget.value;
    if (/^\s*mailto:/i.test(value)) event.currentTarget.value = value.replace(/^\s*mailto:/i, '').trim();
    onChange?.(event);
  }} />;
});
