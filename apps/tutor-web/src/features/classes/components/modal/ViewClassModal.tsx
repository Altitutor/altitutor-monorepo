import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
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
  const [activeTab, setActiveTab] = useState('info');

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
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Loading class...</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto max-w-md">
        <SheetHeader>
          <SheetTitle>
            {classData.level}
          </SheetTitle>
        </SheetHeader>
        
        <div className="mt-6">
          <Tabs 
            defaultValue="info" 
            value={activeTab} 
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
              <TabsTrigger value="students" className="flex-1">Students</TabsTrigger>
              <TabsTrigger value="staff" className="flex-1">Staff</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="mt-4">
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
            </TabsContent>
            
            <TabsContent value="students" className="mt-4">
              <ClassStudentsTab
                classStudents={students}
                allStudents={students} // Students come from view only
                loadingStudents={isLoading}
                onEnrollStudent={async () => {}} // No-op - tutors can't enroll students
                onRemoveStudent={async () => {}} // No-op - tutors can't remove students
              />
            </TabsContent>
            
            <TabsContent value="staff" className="mt-4">
              <ClassStaffTab
                classStaff={staff}
                allStaff={[]} // Not needed for view-only
                loadingStaff={isLoading}
                onAssignStaff={async () => {}} // No-op - tutors can't assign staff
                onRemoveStaff={async () => {}} // No-op - tutors can't remove staff
              />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
