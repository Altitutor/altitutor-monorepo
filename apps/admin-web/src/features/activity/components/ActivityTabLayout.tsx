'use client';

import type { ReactNode } from 'react';
import { ActivityFeed } from './ActivityFeed';
import { ActivityNoteComposer } from './ActivityNoteComposer';
import type { ActivityEventsResponse } from '../types';

interface ActivityTabLayoutProps {
  showComposer?: boolean;
  composerProps?: {
    content: Parameters<typeof ActivityNoteComposer>[0]['content'];
    onChange: Parameters<typeof ActivityNoteComposer>[0]['onChange'];
    onSubmit: Parameters<typeof ActivityNoteComposer>[0]['onSubmit'];
    isSubmitting: boolean;
    canPost: boolean;
  };
  header?: ReactNode;
  footer?: ReactNode;
  data?: ActivityEventsResponse;
  isLoading?: boolean;
  error?: Error | null;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  onOpenFormResponse?: (responseId: string) => void;
}

export function ActivityTabLayout({
  showComposer = false,
  composerProps,
  header,
  footer,
  data,
  isLoading,
  error,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  onOpenFormResponse,
}: ActivityTabLayoutProps) {
  return (
    <div className="h-full space-y-6">
      {header}

      {showComposer && composerProps ? (
        <ActivityNoteComposer
          content={composerProps.content}
          onChange={composerProps.onChange}
          onSubmit={composerProps.onSubmit}
          isSubmitting={composerProps.isSubmitting}
          canPost={composerProps.canPost}
        />
      ) : null}

      <ActivityFeed
        data={data}
        isLoading={isLoading}
        error={error}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={onLoadMore}
        onOpenFormResponse={onOpenFormResponse}
      />

      {footer}
    </div>
  );
}
