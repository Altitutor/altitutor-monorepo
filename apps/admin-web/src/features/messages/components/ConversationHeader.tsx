'use client';

import { Button } from "@altitutor/ui";
import { Search, Info, MailPlus, ArrowLeft } from 'lucide-react';

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onInfoToggle?: () => void;
  onMarkUnread?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ConversationHeader({ 
  title, 
  onSearchToggle, 
  onInfoToggle,
  onMarkUnread,
  onBack,
  showBackButton = false
}: Props) {
  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex items-center justify-between">
      <div className="flex items-center gap-2">
        {showBackButton && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="font-medium">{title || 'Conversation'}</div>
      </div>
      <div className="flex items-center gap-1">
        {onSearchToggle && (
          <Button variant="ghost" size="icon" onClick={onSearchToggle}>
            <Search className="h-4 w-4" />
          </Button>
        )}
        {onMarkUnread && (
          <Button variant="ghost" size="icon" onClick={onMarkUnread}>
            <MailPlus className="h-4 w-4" />
          </Button>
        )}
        {onInfoToggle && (
          <Button variant="ghost" size="icon" onClick={onInfoToggle} className="lg:hidden">
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


