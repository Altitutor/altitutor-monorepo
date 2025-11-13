'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Skeleton, useToast, Button } from "@altitutor/ui";
import { Loader2 } from "lucide-react";
import { messagesKeys } from '../api/queryKeys';
import type { Tables } from '@altitutor/shared';

// Student tabs and components
import { 
  DetailsTab as StudentDetailsTab,
  ClassesTab as StudentClassesTab,
  StudentAccountTab,
  DetailsFormData
} from '@/features/students/components/tabs';
import { ParentDetailsTab } from '@/features/students/components/tabs/ParentDetailsTab';
import { StudentBillingTab } from '@/features/students/components/StudentBillingTab';
import { StudentSessionsTab } from '@/features/students/components/StudentSessionsTab';
import { ViewSubjectModal, SubjectSearchPopover } from '@/features/subjects/components';
import { studentsApi } from '@/features/students/api';
import { mapDetailsFormToStudentUpdate } from '@/features/students/mappers/studentMappers';

// Staff tabs and API
import { 
  StaffDetailsTab,
  StaffDetailsFormData,
  ClassesTab as StaffClassesTab,
  AccountTab as StaffAccountTab
} from '@/features/staff/components/modal/tabs';
import { StudentsTab as StaffStudentsTab } from '@/features/staff/components/modal/tabs/StudentsTab';
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
  const [activeTab, setActiveTab] = useState<string>('details');
  
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
  
  // Base query - only fetch contact info (lightweight, no nested subjects)
  const queryKey = conversationId ? messagesKeys.conversationContact(conversationId) : ['conversation-contact'];
  const { data: conversation, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!conversationId) return null;
      
      const supabase = getSupabaseClient() as any;
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
            students (
              id, first_name, last_name, email, phone, status, year_level, curriculum
            ),
            parents (
              id, first_name, last_name, email, phone,
              parents_students (
                students (
                  id, first_name, last_name, email, phone, status, year_level, curriculum
                )
              )
            ),
            staff (
              id, first_name, last_name, email, phone_number, role, status
            )
          )
        `)
        .eq('id', conversationId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId,
  });
  
  // Fetch subjects only when Details tab is active and we have a student/staff
  const baseContact = conversation?.contacts;
  const baseContactType = baseContact?.contact_type;
  const studentId = baseContactType === 'STUDENT' ? baseContact?.student_id : null;
  const staffId = baseContactType === 'STAFF' ? baseContact?.staff_id : null;
  
  // Subjects query - only when viewing Details tab
  const studentSubjectsQueryKey = conversationId && studentId ? messagesKeys.conversationSubjects(conversationId, 'student') : ['conversation-subjects'];
  const { data: studentSubjectsData } = useQuery({
    queryKey: studentSubjectsQueryKey,
    queryFn: async () => {
      if (!studentId) return null;
      
      const supabase = getSupabaseClient() as any;
      const { data, error } = await supabase
        .from('students_subjects')
        .select('subject_details:subjects(*)')
        .eq('student_id', studentId);
      
      if (error) throw error;
      return (data || []).map((row: any) => row.subject_details).filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: !!conversationId && activeTab === 'details' && !!studentId,
  });
  
  const staffSubjectsQueryKey = conversationId && staffId ? messagesKeys.conversationSubjects(conversationId, 'staff') : ['conversation-subjects'];
  const { data: staffSubjectsData } = useQuery({
    queryKey: staffSubjectsQueryKey,
    queryFn: async () => {
      if (!staffId) return null;
      
      const supabase = getSupabaseClient() as any;
      const { data, error } = await supabase
        .from('staff_subjects')
        .select('subject_details:subjects(*)')
        .eq('staff_id', staffId);
      
      if (error) throw error;
      return (data || []).map((row: any) => row.subject_details).filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: !!conversationId && activeTab === 'details' && !!staffId,
  });
  
  // Attach subjects to contact data for rendering (unused but kept for potential future use)
  const _conversationWithSubjects = useMemo(() => {
    if (!conversation) return null;
    const result = { ...conversation };
    if (result.contacts?.students && studentSubjectsData) {
      (result.contacts.students as any).subjects = studentSubjectsData;
    }
    if (result.contacts?.staff && staffSubjectsData) {
      (result.contacts.staff as any).subjects = staffSubjectsData;
    }
    return result;
  }, [conversation, studentSubjectsData, staffSubjectsData]);

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
        if (conversationId) {
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'student') });
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'staff') });
        }
        
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
              <TabsList className="grid w-full grid-cols-5 flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 min-h-0 overflow-hidden mt-4">
                <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StudentDetailsTab
                    student={student as any}
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
                
                <TabsContent value="classes" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StudentClassesTab
                    student={student as any}
                    onStudentUpdated={() => {
                      if (conversationId) {
                        queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
                      }
                      queryClient.invalidateQueries({ queryKey: ['students', student.id, 'classes'] });
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="account" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StudentAccountTab
                    student={student as any}
                    isLoading={false}
                    hasPasswordResetLinkSent={false}
                    onPasswordResetRequest={async () => {}}
                  />
                </TabsContent>
                
                <TabsContent value="sessions" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StudentSessionsTab student={student as any} />
                </TabsContent>
                
                <TabsContent value="billing" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StudentBillingTab student={student as any} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          {/* Sticky Footer with Buttons */}
          {student && isEditingStudent && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={handleCancelEditStudent} disabled={isLoadingStudentUpdate}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    disabled={isLoadingStudentUpdate}
                    onClick={() => {
                      const form = document.getElementById('student-edit-form') as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {isLoadingStudentUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
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
              if (conversationId) {
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'student') });
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'staff') });
              }
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
        if (conversationId) {
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'student') });
          queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'staff') });
        }
        
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
              <TabsList className="grid w-full grid-cols-4 flex-shrink-0">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classes">Classes</TabsTrigger>
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="account">Account</TabsTrigger>
              </TabsList>
              
              <div className="flex-1 min-h-0 overflow-hidden mt-4">
                <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StaffDetailsTab
                    staffMember={staff as any}
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
                
                <TabsContent value="classes" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StaffClassesTab
                    staff={staff as any}
                    onStaffUpdated={() => {
                      if (conversationId) {
                        queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
                      }
                      queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
                    }}
                  />
                </TabsContent>
                
                <TabsContent value="students" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StaffStudentsTab
                    staffId={staff.id}
                    isOpen={true}
                  />
                </TabsContent>
                
                <TabsContent value="account" className="h-full overflow-y-auto m-0 data-[state=active]:flex data-[state=active]:flex-col">
                  <StaffAccountTab
                    staffMember={staff as any}
                    isLoading={false}
                    hasPasswordResetLinkSent={false}
                    onPasswordResetRequest={async () => {}}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </div>
          
          {/* Sticky Footer with Buttons */}
          {staff && isEditingStaff && (
            <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
              <div className="flex w-full justify-end">
                <div className="flex space-x-2">
                  <Button variant="outline" type="button" onClick={handleCancelEditStaff} disabled={isLoadingStaffUpdate}>
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    disabled={isLoadingStaffUpdate}
                    onClick={() => {
                      const form = document.getElementById('staff-edit-form') as HTMLFormElement;
                      if (form) {
                        form.requestSubmit();
                      }
                    }}
                  >
                    {isLoadingStaffUpdate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
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
              if (conversationId) {
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationContact(conversationId) });
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'student') });
                queryClient.invalidateQueries({ queryKey: messagesKeys.conversationSubjects(conversationId, 'staff') });
              }
            }}
          />
        )}
      </>
    );
  }

  // PARENT contact
  if (contactType === 'PARENT' && contact.parents) {
    const parent = contact.parents as any;
    const students = (parent.parents_students || []).map((ps: any) => ps.students).filter(Boolean) || [];
    
    return (
      <div className={`border-l dark:border-brand-dark-border flex flex-col ${className}`}>
        <div className="p-4 border-b dark:border-brand-dark-border flex-shrink-0">
          <h3 className="font-semibold">{parent.first_name} {parent.last_name}</h3>
          <p className="text-sm text-muted-foreground">Parent</p>
        </div>
        <div className="p-4 overflow-y-auto flex-1 min-h-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
            <TabsList className="grid w-full grid-cols-1 flex-shrink-0">
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 min-h-0 overflow-hidden mt-4">
              <TabsContent value="details" className="h-full overflow-hidden m-0 data-[state=active]:flex data-[state=active]:flex-col">
                <ParentDetailsTab
                  parent={parent}
                  studentIds={students.map((s: any) => s.id)}
                  students={students}
                  onViewStudent={() => {}} // No-op in InfoPanel context
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    );
  }

  // LEAD or OTHER contact
  return (
    <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="font-semibold">{contact?.phone_e164 || 'Unknown Contact'}</h3>
        <p className="text-sm text-muted-foreground">{contact?.contact_type}</p>
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">Phone:</span>{' '}
          <span>{contact?.phone_e164}</span>
        </div>
      </div>
    </div>
  );
}


