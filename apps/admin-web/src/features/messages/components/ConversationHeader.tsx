'use client';

import { Button } from "@altitutor/ui";
import { Search, ArrowLeft } from 'lucide-react';

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
  onTitleClick?: () => void;
}

export function ConversationHeader({ 
  title, 
  onSearchToggle, 
  onBack,
  showBackButton = false,
  onTitleClick
}: Props) {
  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-4">
        {showBackButton && onBack && (
          <Button variant="outline" size="icon" onClick={onBack} className="md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
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


