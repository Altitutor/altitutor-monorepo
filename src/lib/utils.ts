import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const navHoverStyles = "hover:bg-brand-lightBlue/10 text-brand-darkBlue dark:text-white dark:hover:bg-brand-dark-card/70 dark:hover:text-white" 