'use client';

import { Sheet, SheetContent } from "@altitutor/ui";
import { ClassViewContent } from './ClassViewContent';

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

export function ViewClassModal({ 
  isOpen, 
  classId, 
  onClose, 
  onClassUpdated 
}: ViewClassModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideCloseButton className="h-full max-h-[100vh] flex flex-col p-0 w-full md:w-[600px] lg:w-[800px] md:max-w-none">
        {classId && (
          <ClassViewContent
            classId={classId}
            isOpen={isOpen}
            onClose={onClose}
            onClassUpdated={onClassUpdated}
            hideHeader={false}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
