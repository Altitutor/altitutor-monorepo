'use client';

import { Button } from "@altitutor/ui";
import { Search, ArrowLeft } from 'lucide-react';
import { IssuePill } from '@/features/issues';

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  onTitleClick?: () => void;
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
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        {showBackButton && onBack && (
          <Button variant="outline" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {onTitleClick ? (
            <button
              onClick={onTitleClick}
              className="font-medium hover:underline cursor-pointer"
            >
              {title || 'Conversation'}
            </button>
          ) : (
            <div className="font-medium">{title || 'Conversation'}</div>
          )}
          {issuePillProps && (
            <IssuePill
              entityType={issuePillProps.entityType}
              entityId={issuePillProps.entityId}
            />
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onSearchToggle && (
          <Button variant="outline" size="icon" onClick={onSearchToggle}>
            <Search className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


