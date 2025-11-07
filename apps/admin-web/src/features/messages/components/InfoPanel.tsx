'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Skeleton, useToast } from "@altitutor/ui";
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// Student tabs and components
import { 
  DetailsTab as StudentDetailsTab,
  ClassesTab as StudentClassesTab,
  StudentAccountTab,
  DetailsFormData
} from '@/features/students/components/tabs';
import { StudentBillingTab } from '@/features/students/components/StudentBillingTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { studentsApi } from '@/features/students/api';
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';

// Staff tabs and API
import { 
  StaffDetailsTab,
  StaffDetailsFormData,
  SubjectsTab as StaffSubjectsTab,
  ClassesTab as StaffClassesTab,
  AccountTab as StaffAccountTab
} from '@/features/staff/components/modal/tabs';
import { staffApi } from '@/features/staff/api';
import { subjectsApi } from '@/features/subjects/api';

// ViewParentModal not needed here - we render inline

interface InfoPanelProps {
  conversationId: string | null;
  className?: string;
}

export function InfoPanel({ conversationId, className = '' }: InfoPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State for student editing and subject viewing
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [isLoadingStudentUpdate, setIsLoadingStudentUpdate] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  
  // Temporary subjects state for student editing
  const [tempStudentSubjects, setTempStudentSubjects] = useState<Tables<'subjects'>[]>([]);
  const [studentSubjectsToAdd, setStudentSubjectsToAdd] = useState<string[]>([]);
  const [studentSubjectsToRemove, setStudentSubjectsToRemove] = useState<string[]>([]);
  
  // State for staff editing
  const [isEditingStaff, setIsEditingStaff] = useState(false);
  const [isLoadingStaffUpdate, setIsLoadingStaffUpdate] = useState(false);
  
  // Temporary subjects state for staff editing
  const [tempStaffSubjects, setTempStaffSubjects] = useState<Tables<'subjects'>[]>([]);
  const [staffSubjectsToAdd, setStaffSubjectsToAdd] = useState<string[]>([]);
  const [staffSubjectsToRemove, setStaffSubjectsToRemove] = useState<string[]>([]);
  
  // All subjects for selection
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  
  // Fetch all subjects on mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjects = await subjectsApi.getAllSubjects();
        setAllSubjects(subjects);
      } catch (error) {
        console.error('Failed to fetch subjects:', error);
      }
    };
    fetchSubjects();
  }, []);
  
  // Fetch conversation with contact details
  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation-info', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contacts (
            id,
            phone_e164,
            contact_type,
            student_id,
            parent_id,
            staff_id,
            students (*),
            parents (
              *,
              parents_students (
                students (*)
              )
            ),
            staff (*)
          )
        `)
        .eq('id', conversationId)
        .maybeSingle();
      if (error) throw error;
      
      // If we have a student contact, fetch their subjects separately
      if (data?.contacts?.student_id) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('students_subjects')
          .select('subjects(*)')
          .eq('student_id', data.contacts.student_id);
        
        if (subjectsError) {
          console.error('Error fetching student subjects:', subjectsError);
        }
        
        if (subjectsData && data.contacts.students) {
          const subjects = subjectsData
            .map((row: any) => row.subjects)
            .filter(Boolean);
          (data.contacts.students as any).subjects = subjects;
        }
      }
      
      // If we have a staff contact, fetch their subjects separately
      if (data?.contacts?.staff_id) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('staff_subjects')
          .select('subjects(*)')
          .eq('staff_id', data.contacts.staff_id);
        
        if (subjectsError) {
          console.error('Error fetching staff subjects:', subjectsError);
        }
        
        if (subjectsData && data.contacts.staff) {
          const subjects = subjectsData
            .map((row: any) => row.subjects)
            .filter(Boolean);
          (data.contacts.staff as any).subjects = subjects;
        }
      }
      
      // If we have a parent contact, fetch subjects for all their students
      if (data?.contacts?.parent_id && data?.contacts?.parents?.parents_students) {
        const studentIds = data.contacts.parents.parents_students
          .map((ps: any) => ps.students?.id)
          .filter(Boolean);
        
        if (studentIds.length > 0) {
          const { data: allSubjectsData, error: subjectsError } = await supabase
            .from('students_subjects')
            .select('student_id, subjects(*)')
            .in('student_id', studentIds);
          
          if (subjectsError) {
            console.error('Error fetching parent students subjects:', subjectsError);
          }
          
          if (allSubjectsData) {
            // Create a map of student_id -> subjects
            const subjectsMap: Record<string, any[]> = {};
            allSubjectsData.forEach((row: any) => {
              if (!subjectsMap[row.student_id]) {
                subjectsMap[row.student_id] = [];
              }
              const subject = row.subjects;
              if (subject && subject.id) {
                subjectsMap[row.student_id].push(subject);
              }
            });
            
            // Attach subjects to each student
            data.contacts.parents.parents_students.forEach((ps: any) => {
              if (ps.students && subjectsMap[ps.students.id]) {
                ps.students.subjects = subjectsMap[ps.students.id];
              }
            });
          }
        }
      }
      
      return data;
    },
    enabled: !!conversationId,
  });

  if (!conversationId) {
    return (
      <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
        <div className="text-sm text-muted-foreground">Select a conversation to view details</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    );
  }

  if (!conversation?.contacts) {
    return (
      <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
        <div className="text-sm text-muted-foreground">No contact information available</div>
      </div>
    );
  }

  const contact = conversation.contacts;
  const contactType = contact.contact_type;

  // STUDENT contact
  if (contactType === 'STUDENT' && contact.students) {
    const student = contact.students;
    const studentSubjects = (student as any).subjects || [];
    
    const handleStartEditStudent = () => {
      setTempStudentSubjects([...studentSubjects]);
      setStudentSubjectsToAdd([]);
      setStudentSubjectsToRemove([]);
      setIsEditingStudent(true);
    };
    
    const handleCancelEditStudent = () => {
      setTempStudentSubjects([]);
      setStudentSubjectsToAdd([]);
      setStudentSubjectsToRemove([]);
      setIsEditingStudent(false);
    };
    
    const handleStudentEdit = async (data: DetailsFormData) => {
      try {
        setIsLoadingStudentUpdate(true);
        const payload = mapDetailsFormToStudentUpdate(data);
        await studentsApi.updateStudent(student.id, payload);
        
        // Apply subject changes
        for (const subjectId of studentSubjectsToAdd) {
          await studentsApi.assignSubjectToStudent(student.id, subjectId);
        }
        for (const subjectId of studentSubjectsToRemove) {
          await studentsApi.removeSubjectFromStudent(student.id, subjectId);
        }
        
        // Clear temporary subject changes
        setStudentSubjectsToAdd([]);
        setStudentSubjectsToRemove([]);
        
        setIsEditingStudent(false);
        // Refetch conversation data to get updated student info
        queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
        
        toast({
          title: "Success",
          description: "Student details updated successfully.",
        });
      } catch (error) {
        console.error('Failed to update student:', error);
        toast({
          title: "Error",
          description: "Failed to update student details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingStudentUpdate(false);
      }
    };
    
    const handleAssignSubjectToStudent = (subject: Tables<'subjects'>) => {
      if (!subject) return;
      
      setTempStudentSubjects(prev => [...prev, subject]);
      
      if (studentSubjectsToRemove.includes(subject.id)) {
        setStudentSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
      } else {
        setStudentSubjectsToAdd(prev => [...prev, subject.id]);
      }
    };
    
    const handleRemoveSubjectFromStudent = (subjectId: string) => {
      setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
      
      if (studentSubjectsToAdd.includes(subjectId)) {
        setStudentSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
      } else {
        setStudentSubjectsToRemove(prev => [...prev, subjectId]);
      }
    };
    
    const handleViewSubject = (subjectId: string) => {
      setSelectedSubjectId(subjectId);
      setIsSubjectModalOpen(true);
    };
    
    return (
      <>
        <div className={`border-l dark:border-brand-dark-border flex flex-col ${className}`}>
          <div className="p-4 border-b dark:border-brand-dark-border flex-shrink-0">
            <h3 className="font-semibold">{student.first_name} {student.last_name}</h3>
            <p className="text-sm text-muted-foreground">Student</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4">
                <StudentDetailsTab
                  student={student}
                  isEditing={isEditingStudent}
                  isLoading={isLoadingStudentUpdate}
                  onEdit={handleStartEditStudent}
                  onCancelEdit={handleCancelEditStudent}
                  onSubmit={handleStudentEdit}
                  studentSubjects={isEditingStudent ? tempStudentSubjects : studentSubjects}
                  loadingSubjects={false}
                  onRemoveSubject={handleRemoveSubjectFromStudent}
                  onViewSubject={handleViewSubject}
                  addSubjectButton={
                    <SubjectSearchPopover
                      allSubjects={allSubjects}
                      selectedSubjects={isEditingStudent ? tempStudentSubjects : studentSubjects}
                      onSelectSubject={handleAssignSubjectToStudent}
                    />
                  }
                />
              </TabsContent>
              
              <TabsContent value="classes" className="mt-4">
                <StudentClassesTab
                  student={student}
                  onStudentUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="account" className="mt-4">
                <StudentAccountTab
                  student={student}
                  isLoading={false}
                  hasPasswordResetLinkSent={false}
                  isDeleting={false}
                  onPasswordResetRequest={async () => {}}
                  onDelete={async () => {}}
                />
              </TabsContent>
              
              <TabsContent value="billing" className="mt-4">
                <StudentBillingTab student={student} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* Subject Modal */}
        {selectedSubjectId && (
          <ViewSubjectModal
            isOpen={isSubjectModalOpen}
            onClose={() => {
              setIsSubjectModalOpen(false);
              setSelectedSubjectId(null);
            }}
            subjectId={selectedSubjectId}
            onSubjectUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
            }}
          />
        )}
      </>
    );
  }

  // STAFF contact
  if (contactType === 'STAFF' && contact.staff) {
    const staff = contact.staff;
    const staffSubjects = (staff as any).subjects || [];
    
    const handleStartEditStaff = () => {
      setTempStaffSubjects([...staffSubjects]);
      setStaffSubjectsToAdd([]);
      setStaffSubjectsToRemove([]);
      setIsEditingStaff(true);
    };
    
    const handleCancelEditStaff = () => {
      setTempStaffSubjects([]);
      setStaffSubjectsToAdd([]);
      setStaffSubjectsToRemove([]);
      setIsEditingStaff(false);
    };
    
    const handleStaffEdit = async (data: StaffDetailsFormData) => {
      try {
        setIsLoadingStaffUpdate(true);
        await staffApi.updateStaff(staff.id, {
          first_name: data.firstName,
          last_name: data.lastName,
          email: data.email || undefined,
          phone_number: data.phoneNumber || null,
          role: data.role,
          status: data.status,
          office_key_number: data.officeKeyNumber,
          has_parking_remote: data.hasParkingRemote,
          availability_monday: data.availability_monday,
          availability_tuesday: data.availability_tuesday,
          availability_wednesday: data.availability_wednesday,
          availability_thursday: data.availability_thursday,
          availability_friday: data.availability_friday,
          availability_saturday_am: data.availability_saturday_am,
          availability_saturday_pm: data.availability_saturday_pm,
          availability_sunday_am: data.availability_sunday_am,
          availability_sunday_pm: data.availability_sunday_pm
        });
        
        // Apply subject changes
        for (const subjectId of staffSubjectsToAdd) {
          await staffApi.assignSubjectToStaff(staff.id, subjectId);
        }
        for (const subjectId of staffSubjectsToRemove) {
          await staffApi.removeSubjectFromStaff(staff.id, subjectId);
        }
        
        // Clear temporary subject changes
        setStaffSubjectsToAdd([]);
        setStaffSubjectsToRemove([]);
        
        setIsEditingStaff(false);
        queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
        
        toast({
          title: "Success",
          description: "Staff details updated successfully.",
        });
      } catch (error) {
        console.error('Failed to update staff:', error);
        toast({
          title: "Error",
          description: "Failed to update staff details. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingStaffUpdate(false);
      }
    };
    
    const handleAssignSubjectToStaff = (subjectId: string) => {
      const subject = allSubjects.find(s => s.id === subjectId);
      if (!subject) return;
      
      setTempStaffSubjects(prev => [...prev, subject]);
      
      if (staffSubjectsToRemove.includes(subjectId)) {
        setStaffSubjectsToRemove(prev => prev.filter(id => id !== subjectId));
      } else {
        setStaffSubjectsToAdd(prev => [...prev, subjectId]);
      }
    };
    
    const handleRemoveSubjectFromStaff = (subjectId: string) => {
      setTempStaffSubjects(prev => prev.filter(s => s.id !== subjectId));
      
      if (staffSubjectsToAdd.includes(subjectId)) {
        setStaffSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
      } else {
        setStaffSubjectsToRemove(prev => [...prev, subjectId]);
      }
    };
    
    const handleViewSubjectStaff = (subjectId: string) => {
      setSelectedSubjectId(subjectId);
      setIsSubjectModalOpen(true);
    };
    
    return (
      <>
        <div className={`border-l dark:border-brand-dark-border flex flex-col ${className}`}>
          <div className="p-4 border-b dark:border-brand-dark-border flex-shrink-0">
            <h3 className="font-semibold">{staff.first_name} {staff.last_name}</h3>
            <p className="text-sm text-muted-foreground">Staff</p>
          </div>
          <div className="p-4 overflow-y-auto flex-1 min-h-0">
            <Tabs defaultValue="details">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="mt-4">
                <StaffDetailsTab
                  staffMember={staff}
                  isEditing={isEditingStaff}
                  isLoading={isLoadingStaffUpdate}
                  onEdit={handleStartEditStaff}
                  onCancelEdit={handleCancelEditStaff}
                  onSubmit={handleStaffEdit}
                  staffSubjects={isEditingStaff ? tempStaffSubjects : staffSubjects}
                  loadingSubjects={false}
                  onRemoveSubject={handleRemoveSubjectFromStaff}
                  onViewSubject={handleViewSubjectStaff}
                  addSubjectButton={
                    <SubjectSearchPopover
                      allSubjects={allSubjects}
                      selectedSubjects={isEditingStaff ? tempStaffSubjects : staffSubjects}
                      onSelectSubject={(subject) => handleAssignSubjectToStaff(subject.id)}
                    />
                  }
                />
              </TabsContent>
              
              <TabsContent value="classes" className="mt-4">
                <StaffClassesTab
                  staff={staff}
                />
              </TabsContent>
              
              <TabsContent value="account" className="mt-4">
                <StaffAccountTab
                  staffMember={staff}
                  isLoading={false}
                  hasPasswordResetLinkSent={false}
                  onPasswordResetRequest={async () => {}}
                  onDelete={async () => {}}
                  isDeleting={false}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
        
        {/* Subject Modal */}
        {selectedSubjectId && (
          <ViewSubjectModal
            isOpen={isSubjectModalOpen}
            onClose={() => {
              setIsSubjectModalOpen(false);
              setSelectedSubjectId(null);
            }}
            subjectId={selectedSubjectId}
            onSubjectUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
            }}
          />
        )}
      </>
    );
  }

  // PARENT contact
  if (contactType === 'PARENT' && contact.parents) {
    const parent = contact.parents;
    const students = parent.parents_students?.map((ps: any) => ps.students).filter(Boolean) || [];
    
    return (
      <>
      <div className={`border-l dark:border-brand-dark-border flex flex-col ${className}`}>
        <div className="p-4 border-b dark:border-brand-dark-border flex-shrink-0">
          <h3 className="font-semibold">{parent.first_name} {parent.last_name}</h3>
          <p className="text-sm text-muted-foreground">Parent</p>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          {/* Parent details */}
          <div className="mb-6 space-y-2">
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Email:</span>{' '}
              <span>{parent.email || '-'}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Phone:</span>{' '}
              <span>{parent.phone || '-'}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Students:</span>{' '}
              <span>{students.map((s: any) => `${s.first_name} ${s.last_name}`).join(', ')}</span>
            </div>
          </div>
          
          {/* Student tabs */}
          {students.length > 0 && (
            <Tabs defaultValue={students[0].id}>
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(students.length, 3)}, minmax(0, 1fr))` }}>
                {students.map((student: any) => (
                  <TabsTrigger key={student.id} value={student.id}>
                    {student.first_name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {students.map((student: any) => {
                const studentSubjects = student.subjects || [];
                
                const handleStartEditStudent = () => {
                  setTempStudentSubjects([...studentSubjects]);
                  setStudentSubjectsToAdd([]);
                  setStudentSubjectsToRemove([]);
                  setIsEditingStudent(true);
                };
                
                const handleCancelEditStudent = () => {
                  setTempStudentSubjects([]);
                  setStudentSubjectsToAdd([]);
                  setStudentSubjectsToRemove([]);
                  setIsEditingStudent(false);
                };
                
                const handleStudentEdit = async (data: DetailsFormData) => {
                  try {
                    setIsLoadingStudentUpdate(true);
                    const payload = mapDetailsFormToStudentUpdate(data);
                    await studentsApi.updateStudent(student.id, payload);
                    
                    // Apply subject changes
                    for (const subjectId of studentSubjectsToAdd) {
                      await studentsApi.assignSubjectToStudent(student.id, subjectId);
                    }
                    for (const subjectId of studentSubjectsToRemove) {
                      await studentsApi.removeSubjectFromStudent(student.id, subjectId);
                    }
                    
                    // Clear temporary subject changes
                    setStudentSubjectsToAdd([]);
                    setStudentSubjectsToRemove([]);
                    
                    setIsEditingStudent(false);
                    queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
                    
                    toast({
                      title: "Success",
                      description: "Student details updated successfully.",
                    });
                  } catch (error) {
                    console.error('Failed to update student:', error);
                    toast({
                      title: "Error",
                      description: "Failed to update student details. Please try again.",
                      variant: "destructive",
                    });
                  } finally {
                    setIsLoadingStudentUpdate(false);
                  }
                };
                
                const handleAssignSubjectToStudent = (subject: Tables<'subjects'>) => {
                  if (!subject) return;
                  
                  setTempStudentSubjects(prev => [...prev, subject]);
                  
                  if (studentSubjectsToRemove.includes(subject.id)) {
                    setStudentSubjectsToRemove(prev => prev.filter(id => id !== subject.id));
                  } else {
                    setStudentSubjectsToAdd(prev => [...prev, subject.id]);
                  }
                };
                
                const handleRemoveSubjectFromStudent = (subjectId: string) => {
                  setTempStudentSubjects(prev => prev.filter(s => s.id !== subjectId));
                  
                  if (studentSubjectsToAdd.includes(subjectId)) {
                    setStudentSubjectsToAdd(prev => prev.filter(id => id !== subjectId));
                  } else {
                    setStudentSubjectsToRemove(prev => [...prev, subjectId]);
                  }
                };
                
                const handleViewSubject = (subjectId: string) => {
                  setSelectedSubjectId(subjectId);
                  setIsSubjectModalOpen(true);
                };
                
                return (
                  <TabsContent key={student.id} value={student.id}>
                    <Tabs defaultValue="details" className="mt-4">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="details">Details</TabsTrigger>
                        <TabsTrigger value="classes">Classes</TabsTrigger>
                        <TabsTrigger value="account">Account</TabsTrigger>
                        <TabsTrigger value="billing">Billing</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="details" className="mt-4">
                        <StudentDetailsTab
                          student={student}
                          isEditing={isEditingStudent}
                          isLoading={isLoadingStudentUpdate}
                          onEdit={handleStartEditStudent}
                          onCancelEdit={handleCancelEditStudent}
                          onSubmit={handleStudentEdit}
                          studentSubjects={isEditingStudent ? tempStudentSubjects : studentSubjects}
                          loadingSubjects={false}
                          onRemoveSubject={handleRemoveSubjectFromStudent}
                          onViewSubject={handleViewSubject}
                          addSubjectButton={
                            <SubjectSearchPopover
                              allSubjects={allSubjects}
                              selectedSubjects={isEditingStudent ? tempStudentSubjects : studentSubjects}
                              onSelectSubject={handleAssignSubjectToStudent}
                            />
                          }
                        />
                      </TabsContent>
                      
                      <TabsContent value="classes" className="mt-4">
                        <StudentClassesTab
                          student={student}
                          onStudentUpdated={() => {
                            queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
                          }}
                        />
                      </TabsContent>
                      
                      <TabsContent value="account" className="mt-4">
                        <StudentAccountTab
                          student={student}
                          isLoading={false}
                          hasPasswordResetLinkSent={false}
                          isDeleting={false}
                          onPasswordResetRequest={async () => {}}
                          onDelete={async () => {}}
                        />
                      </TabsContent>
                      
                      <TabsContent value="billing" className="mt-4">
                        <StudentBillingTab student={student} />
                      </TabsContent>
                    </Tabs>
                  </TabsContent>
                );
              })}
            </Tabs>
          )}
        </div>
      </div>
        
        {/* Subject Modal */}
        {selectedSubjectId && (
          <ViewSubjectModal
            isOpen={isSubjectModalOpen}
            onClose={() => {
              setIsSubjectModalOpen(false);
              setSelectedSubjectId(null);
            }}
            subjectId={selectedSubjectId}
            onSubjectUpdated={() => {
              queryClient.invalidateQueries({ queryKey: ['conversation-info', conversationId] });
            }}
          />
        )}
      </>
    );
  }

  // LEAD or OTHER contact
  return (
    <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="font-semibold">{contact.phone_e164 || 'Unknown Contact'}</h3>
        <p className="text-sm text-muted-foreground">{contact.contact_type}</p>
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">Phone:</span>{' '}
          <span>{contact.phone_e164}</span>
        </div>
      </div>
    </div>
  );
}

