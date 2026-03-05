'use client';

import { Button } from "@altitutor/ui";
import { Search, ArrowLeft, Mail } from 'lucide-react';
import { cn } from '@/shared/utils';
import { IssuePill } from '@/features/issues';

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  onTitleClick?: () => void;
   isUnread?: boolean;
   onToggleRead?: () => void;
  contact?: {
    contact_type: string;
    students?: { id: string } | null;
    parents?: { id: string } | null;
    staff?: { id: string } | null;
  } | null;
}

export function ConversationHeader({ 
  title, 
  onSearchToggle, 
  onBack,
  showBackButton = false,
  onTitleClick,
  isUnread,
  onToggleRead,
  contact
}: Props) {
  const getIssuePillProps = () => {
    if (!contact) return null;
    
    if (contact.contact_type === 'STUDENT' && contact.students?.id) {
      return { entityType: 'student' as const, entityId: contact.students.id };
    }
    if (contact.contact_type === 'STAFF' && contact.staff?.id) {
      return { entityType: 'staff' as const, entityId: contact.staff.id };
    }
    if (contact.contact_type === 'PARENT' && contact.parents?.id) {
      return { entityType: 'parent' as const, entityId: contact.parents.id };
    }
    return null;
  };

  const issuePillProps = getIssuePillProps();

  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex flex-col gap-2 flex-shrink-0">
      {/* Row 1: back | contact name (truncate) | search - always one line */}
      <div className="flex items-center gap-2 min-w-0 flex-nowrap">
        {showBackButton && onBack && (
          <Button variant="outline" size="icon" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1 flex items-center justify-start">
          {onTitleClick ? (
            <button
              onClick={onTitleClick}
              className="font-medium hover:underline cursor-pointer truncate text-left w-full"
              title={title || 'Conversation'}
            >
              {title || 'Conversation'}
            </button>
          ) : (
            <div className="font-medium truncate" title={title || 'Conversation'}>
              {title || 'Conversation'}
            </div>
          )}
        </div>
        {onToggleRead && (
          <Button
            variant={isUnread ? 'default' : 'outline'}
            size="icon"
            onClick={onToggleRead}
            className={cn(
              "flex-shrink-0",
              isUnread && "bg-red-500 text-white hover:bg-red-600 border-transparent"
            )}
            title={isUnread ? "Mark as read" : "Mark as unread"}
          >
            <Mail className="h-4 w-4" />
          </Button>
        )}
        {onSearchToggle && (
          <Button variant="outline" size="icon" onClick={onSearchToggle} className="flex-shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>
      {/* Row 2: issue pills - inline, max width, truncate with full name on hover */}
      {issuePillProps && (
        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <IssuePill
            entityType={issuePillProps.entityType}
            entityId={issuePillProps.entityId}
            className="min-w-0 max-w-full flex-wrap"
            truncateWithTitle
          />
        </div>
      )}
    </div>
  );
}


