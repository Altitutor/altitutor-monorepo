// Re-export TopicFilePreviewModal as FilePreviewModal for backward compatibility
// This provides automatic topic metadata fetching
export { TopicFilePreviewModal as FilePreviewModal } from './TopicFilePreviewModal';
// Also export the generic version for cases where topic metadata isn't needed
export { FilePreviewModal as GenericFilePreviewModal } from '@/shared/components/files/FilePreviewModal';
export type { FilePreviewModalProps } from '@/shared/components/files/FilePreviewModal';
