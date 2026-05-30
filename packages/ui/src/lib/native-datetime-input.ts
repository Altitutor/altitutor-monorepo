/** Tailwind classes for native date/time inputs (Safari mobile overflow). */
export const NATIVE_DATETIME_INPUT_CLASSNAME =
  'min-w-0 max-w-full overflow-hidden [&::-webkit-date-and-time-value]:min-w-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:flex [&::-webkit-datetime-edit]:min-w-0 [&::-webkit-datetime-edit-fields-wrapper]:min-w-0';

export function isNativeDateTimeInputType(
  type?: string
): type is 'date' | 'time' | 'datetime-local' {
  return type === 'date' || type === 'time' || type === 'datetime-local';
}
