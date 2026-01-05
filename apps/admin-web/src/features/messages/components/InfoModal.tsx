'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { InfoPanel } from './InfoPanel';

interface InfoModalProps {
  contactId?: string | null;
  conversationId?: string | null; // For backward compatibility
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ contactId, conversationId, isOpen, onClose }: InfoModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[480px] md:max-w-none overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Contact Information</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <InfoPanel contactId={contactId} conversationId={conversationId} className="border-none" />
        </div>
      </SheetContent>
    </Sheet>
  );
}


