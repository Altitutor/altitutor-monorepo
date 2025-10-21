// Utility hooks
export { useDebounce } from './useDebounce';
export { useLocalStorage } from './useLocalStorage';
export { useMediaQuery } from './useMediaQuery';
// Repository hook removed under Option A

// Re-export all feature hooks
export * from '@/features/students/hooks';
export * from '@/features/staff/hooks';
export * from '@/features/sessions/hooks';
export * from '@/features/classes/hooks';
export * from '@/features/subjects/hooks';
export * from '@/features/topics/hooks';

// Repository-based hooks removed under Option A; use feature hooks or direct APIs