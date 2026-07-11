'use client';

import {
  SmartDatePickerPill,
  type SmartDatePickerPillProps,
  type SmartDatePickerValueFormat,
} from '@altitutor/ui';

export type DatePickerPillValueFormat = SmartDatePickerValueFormat;
export type DatePickerPillProps = SmartDatePickerPillProps;

export function DatePickerPill(props: DatePickerPillProps) {
  return <SmartDatePickerPill {...props} />;
}
