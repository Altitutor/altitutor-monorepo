import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel';
import { cn } from '@/shared/utils';
import { tutorSheetContentClass } from '@/shared/lib/tutor-visual';
import { useClassModalData } from '../../hooks/useClassModalData';
import { ClassInfoTab } from './tabs/ClassInfoTab';
import { ClassStudentsTab } from './tabs/ClassStudentsTab';
import { ClassStaffTab } from './tabs/ClassStaffTab';

interface ViewClassModalProps {
  isOpen: boolean;
  classId: string | null;
  onClose: () => void;
  onClassUpdated: () => void;
}

/**
 * ViewClassModal for tutor-web
 * 
 * IMPORTANT: Tutors can only VIEW class details, not edit them.
 * All data comes from vtutor_class_detail view which includes students and staff as JSON arrays.
 */
export function ViewClassModal({ 
  isOpen, 
  classId, 
  onClose, 
  onClassUpdated: _onClassUpdated 
}: ViewClassModalProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'students' | 'staff'>('info');

  // Use hook for all class data loading and processing
  const {
    classDetail,
    students,
    staff,
    classData,
    subject,
    isLoading,
  } = useClassModalData({
    isOpen,
    classId,
  });

  // Early return if no class data loaded
  if (!classDetail || !classData) {
    return (
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className={cn(tutorSheetContentClass, 'max-w-md')}>
          <SheetHeader>
            <SheetTitle>Loading class...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className={cn(tutorSheetContentClass, 'max-w-md overflow-y-auto')}>
        <SheetHeader>
          <SheetTitle>
            {classData.level}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          <SegmentedTabPanel
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'info' | 'students' | 'staff')}
            className="w-full"
            options={[
              { value: 'info', label: 'Info' },
              { value: 'students', label: 'Students' },
              { value: 'staff', label: 'Staff' },
            ]}
          >
            <SegmentedTabPanelContent when="info" activeTab={activeTab} className="mt-4">
              <ClassInfoTab
                classData={classData}
                subject={subject}
                subjects={[]} // Not needed for view-only
                isEditing={false} // Tutors can't edit
                isLoading={isLoading}
                onEdit={() => {}} // No-op
                onCancelEdit={() => {}} // No-op
                onSubmit={async () => {}} // No-op - tutors can't update classes
              />
            </SegmentedTabPanelContent>

            <SegmentedTabPanelContent when="students" activeTab={activeTab} className="mt-4">
              <ClassStudentsTab
                classStudents={students}
                allStudents={students} // Students come from view only
                loadingStudents={isLoading}
                onEnrollStudent={async () => {}} // No-op - tutors can't enroll students
                onRemoveStudent={async () => {}} // No-op - tutors can't remove students
              />
            </SegmentedTabPanelContent>

            <SegmentedTabPanelContent when="staff" activeTab={activeTab} className="mt-4">
              <ClassStaffTab
                classStaff={staff}
                allStaff={[]} // Not needed for view-only
                loadingStaff={isLoading}
                onAssignStaff={async () => {}} // No-op - tutors can't assign staff
                onRemoveStaff={async () => {}} // No-op - tutors can't remove staff
              />
            </SegmentedTabPanelContent>
          </SegmentedTabPanel>
        </div>
      </SheetContent>
    </Sheet>
  );
}
