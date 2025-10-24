'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { InfoPanel } from './InfoPanel';

interface InfoModalProps {
  conversationId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function InfoModal({ conversationId, isOpen, onClose }: InfoModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Contact Information</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <InfoPanel conversationId={conversationId} className="border-none" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

