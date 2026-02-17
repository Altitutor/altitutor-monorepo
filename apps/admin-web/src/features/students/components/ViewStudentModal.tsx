'use client';

import { Sheet, SheetContent } from "@altitutor/ui";
import { StudentViewContent } from './StudentViewContent';

interface ViewStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
  onStudentUpdated: () => void;
}

export function ViewStudentModal({
  isOpen,
  onClose,
  studentId,
  onStudentUpdated
}: ViewStudentModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent hideCloseButton className="w-full md:w-[600px] lg:w-[800px] md:max-w-none h-full max-h-[100vh] flex flex-col p-0">
        {studentId && (
          <StudentViewContent
            studentId={studentId}
            isOpen={isOpen}
            onClose={onClose}
            onStudentUpdated={onStudentUpdated}
            hideHeader={false}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
