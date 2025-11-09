import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@altitutor/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { classesApi } from "../../api";
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
  onClassUpdated 
}: ViewClassModalProps) {
  // State - using view structure
  const [classDetail, setClassDetail] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  
  const { toast } = useToast();

  // Fetch class data from vtutor_class_detail view
  useEffect(() => {
    if (isOpen && classId) {
      fetchClassData();
    } else {
      // Reset state when closing
      setClassDetail(null);
      setActiveTab('info');
    }
  }, [isOpen, classId]);

  const fetchClassData = async () => {
    if (!classId) return;
    
    try {
      setIsLoading(true);
      
      // Get class details from vtutor_class_detail view
      const detail = await classesApi.getClassWithDetails(classId);
      
      if (!detail) {
        throw new Error('Class not found or you do not have access to it');
      }
      
      setClassDetail(detail);
    } catch (err) {
      console.error('Failed to fetch class:', err);
      toast({
        title: 'Error',
        description: 'Failed to load class details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Early return if no class data loaded
  if (!classDetail) {
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

  // Parse students and staff from JSON arrays
  const students = Array.isArray(classDetail.students) ? classDetail.students : [];
  const staff = Array.isArray(classDetail.staff) ? classDetail.staff : [];

  // Build class object for compatibility
  const classData = {
    id: classDetail.class_id,
    day_of_week: classDetail.day_of_week,
    start_time: classDetail.start_time,
    end_time: classDetail.end_time,
    room: classDetail.room,
    level: classDetail.class_level,
    status: classDetail.class_status,
    subject_id: classDetail.subject_id,
    created_at: classDetail.created_at,
    updated_at: classDetail.updated_at,
  };

  // Build subject object from flattened fields
  const subject = classDetail.subject_id ? {
    id: classDetail.subject_id,
    name: classDetail.subject_name,
    curriculum: classDetail.subject_curriculum,
    discipline: classDetail.subject_discipline,
    level: classDetail.subject_level,
    color: classDetail.subject_color,
    year_level: classDetail.subject_year_level,
  } : null;

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
                classData={classData as any}
                subject={subject as any}
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
                classData={classData as any}
                classStudents={students}
                allStudents={students} // Students come from view only
                loadingStudents={isLoading}
                onEnrollStudent={async () => {}} // No-op - tutors can't enroll students
                onRemoveStudent={async () => {}} // No-op - tutors can't remove students
              />
            </TabsContent>
            
            <TabsContent value="staff" className="mt-4">
              <ClassStaffTab
                classData={classData as any}
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
