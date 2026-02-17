'use client';

import { Sheet, SheetContent } from "@altitutor/ui";
import { StaffViewContent } from './StaffViewContent';

interface ViewStaffModalProps {
  isOpen: boolean;
  staffId: string | null;
  onClose: () => void;
  onStaffUpdated: () => void;
}

export function ViewStaffModal({ 
  isOpen, 
  staffId, 
  onClose, 
  onStaffUpdated 
}: ViewStaffModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
        {staffId && (
          <StaffViewContent
            staffId={staffId}
            isOpen={isOpen}
            onClose={onClose}
            onStaffUpdated={onStaffUpdated}
            hideHeader={false}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
