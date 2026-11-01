'use client';

import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { toolbarControlStyles } from '../lib/toolbar-control-styles';

export const entityChipStyles = cn(
  'inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium align-baseline no-underline',
  toolbarControlStyles,
);

/** Shared icon paths also render in serialized rich text, without a React-only node view. */
const icons: Record<string, readonly string[]> = {
  student: ['m2 9 10-5 10 5-10 5Z', 'M6 11v6c4 3 8 3 12 0v-6', 'M22 9v7'],
  parent: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10'],
  staff: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
  class: ['M3 6h18v15H3Z', 'M3 10h18', 'M8 3v5', 'M16 3v5'],
  session: ['M3 6h18v15H3Z', 'M3 10h18', 'M8 3v5', 'M16 3v5'],
  invoice: ['M2 5h20v14H2Z', 'M2 10h20', 'M6 15h3'],
  subject: ['M9 3h6', 'M10 3v7L4 20h16l-6-10V3', 'M7 16h10'],
  topic: ['M4 3h16v18H4Z', 'M8 7h8', 'M8 11h8', 'M8 15h4'],
  task: ['M9 11l3 3L22 4', 'M21 12v8H3V3h12'],
  issue: ['m12 3 10 18H2Z', 'M12 9v4', 'M12 17h.01'],
  project: ['M3 7V4h6l2 3h10v14H3Z', 'M8 11v6', 'M12 11v3', 'M16 11v5'],
  file: ['M14 2H4v20h16V8Z', 'M14 2v6h6'],
  note: ['M14 2H4v20h16V8Z', 'M14 2v6h6', 'M8 13h8', 'M8 17h5'],
};
export function entityIconPaths(type: string): readonly string[] {
  const singular = type === 'classes' ? 'class' : type.replace(/s$/, '');
  return icons[singular === 'document' ? 'note' : singular] ?? icons.file!;
}
export function EntityChipIcon({entityType}: {entityType: string}) {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
    {entityIconPaths(entityType).map((d, index) => <path key={index} d={d} />)}
  </svg>;
}
export function EntityChip({entityType, label, className, ...props}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {entityType: string; label: string}) {
  return <button {...props} type="button" className={cn(entityChipStyles, 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
    <EntityChipIcon entityType={entityType} /><span className="truncate">{label}</span>
  </button>;
}
