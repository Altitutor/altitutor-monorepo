'use client';

import { Button } from "@altitutor/ui";
import { Search, Info, ArrowLeft } from 'lucide-react';

interface Props {
  title?: string;
  onSearchToggle?: () => void;
  onInfoToggle?: () => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function ConversationHeader({ 
  title, 
  onSearchToggle, 
  onInfoToggle,
  onBack,
  showBackButton = false
}: Props) {
  return (
    <div className="px-6 py-3 border-b dark:border-brand-dark-border flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-2">
        {showBackButton && onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
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
        {onInfoToggle && (
          <Button variant="ghost" size="icon" onClick={onInfoToggle} className="xl:hidden">
            <Info className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}


