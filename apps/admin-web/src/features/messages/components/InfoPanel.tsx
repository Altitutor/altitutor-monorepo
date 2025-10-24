'use client';

import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@altitutor/ui";
import { Skeleton } from "@altitutor/ui";

// Student tabs
import { 
  DetailsTab as StudentDetailsTab,
  StudentSubjectsTab, 
  ClassesTab as StudentClassesTab,
  StudentAccountTab
} from '@/features/students/components/tabs';

// Staff tabs
import { 
  StaffDetailsTab,
  SubjectsTab as StaffSubjectsTab,
  ClassesTab as StaffClassesTab,
  AccountTab as StaffAccountTab
} from '@/features/staff/components/modal/tabs';

// ViewParentModal not needed here - we render inline

interface InfoPanelProps {
  conversationId: string | null;
  className?: string;
}

export function InfoPanel({ conversationId, className = '' }: InfoPanelProps) {
  // Fetch conversation with contact details
  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation-info', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          contacts (
            id,
            display_name,
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
    return (
      <div className={`border-l dark:border-brand-dark-border overflow-y-auto ${className}`}>
        <div className="p-4 border-b dark:border-brand-dark-border">
          <h3 className="font-semibold">{student.first_name} {student.last_name}</h3>
          <p className="text-sm text-muted-foreground">Student</p>
        </div>
        <div className="p-4">
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
              <StudentDetailsTab
                student={student}
                isEditing={false}
                isLoading={false}
                onEdit={() => {}}
                onCancelEdit={() => {}}
                onSubmit={() => {}}
              />
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-4">
              <StudentSubjectsTab
                student={student}
                studentSubjects={(student as any).subjects || []}
                allSubjects={[]}
                loadingSubjects={false}
                onAssignSubject={() => {}}
                onRemoveSubject={() => {}}
              />
            </TabsContent>
            
            <TabsContent value="classes" className="mt-4">
              <StudentClassesTab
                student={student}
                onStudentUpdated={() => {}}
              />
            </TabsContent>
            
            <TabsContent value="account" className="mt-4">
              <StudentAccountTab
                student={student}
                isLoading={false}
                isEditingAccount={false}
                hasPasswordResetLinkSent={false}
                isDeleting={false}
                onEditAccount={() => {}}
                onCancelEditAccount={() => {}}
                onAccountUpdate={async () => {}}
                onPasswordResetRequest={async () => {}}
                onDelete={async () => {}}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // STAFF contact
  if (contactType === 'STAFF' && contact.staff) {
    const staff = contact.staff;
    return (
      <div className={`border-l dark:border-brand-dark-border overflow-y-auto ${className}`}>
        <div className="p-4 border-b dark:border-brand-dark-border">
          <h3 className="font-semibold">{staff.first_name} {staff.last_name}</h3>
          <p className="text-sm text-muted-foreground">Staff</p>
        </div>
        <div className="p-4">
          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="classes">Classes</TabsTrigger>
              <TabsTrigger value="account">Account</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-4">
              <StaffDetailsTab
                staffMember={staff}
                isEditing={false}
                isLoading={false}
                onEdit={() => {}}
                onCancelEdit={() => {}}
                onSubmit={async () => {}}
              />
            </TabsContent>
            
            <TabsContent value="subjects" className="mt-4">
              <StaffSubjectsTab
                staffMember={staff}
                staffSubjects={(staff as any).subjects || []}
                allSubjects={[]}
                loadingSubjects={false}
                onAssignSubject={() => {}}
                onRemoveSubject={() => {}}
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
                isEditingAccount={false}
                hasPasswordResetLinkSent={false}
                onEditAccount={() => {}}
                onCancelEditAccount={() => {}}
                onAccountUpdate={async () => {}}
                onPasswordResetRequest={async () => {}}
                onDelete={async () => {}}
                isDeleting={false}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // PARENT contact
  if (contactType === 'PARENT' && contact.parents) {
    const parent = contact.parents;
    const students = parent.parents_students?.map((ps: any) => ps.students).filter(Boolean) || [];
    
    return (
      <div className={`border-l dark:border-brand-dark-border overflow-y-auto ${className}`}>
        <div className="p-4 border-b dark:border-brand-dark-border">
          <h3 className="font-semibold">{parent.first_name} {parent.last_name}</h3>
          <p className="text-sm text-muted-foreground">Parent</p>
        </div>
        <div className="p-4">
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
              
              {students.map((student: any) => (
                <TabsContent key={student.id} value={student.id}>
                  <Tabs defaultValue="details" className="mt-4">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="subjects">Subjects</TabsTrigger>
                      <TabsTrigger value="classes">Classes</TabsTrigger>
                      <TabsTrigger value="account">Account</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="details" className="mt-4">
                      <StudentDetailsTab
                        student={student}
                        isEditing={false}
                        isLoading={false}
                        onEdit={() => {}}
                        onCancelEdit={() => {}}
                        onSubmit={() => {}}
                      />
                    </TabsContent>
                    
                    <TabsContent value="subjects" className="mt-4">
                      <StudentSubjectsTab
                        student={student}
                        studentSubjects={(student as any).subjects || []}
                        allSubjects={[]}
                        loadingSubjects={false}
                        onAssignSubject={() => {}}
                        onRemoveSubject={() => {}}
                      />
                    </TabsContent>
                    
                    <TabsContent value="classes" className="mt-4">
                      <StudentClassesTab
                        student={student}
                        onStudentUpdated={() => {}}
                      />
                    </TabsContent>
                    
                    <TabsContent value="account" className="mt-4">
                      <StudentAccountTab
                        student={student}
                        isLoading={false}
                        isEditingAccount={false}
                        hasPasswordResetLinkSent={false}
                        isDeleting={false}
                        onEditAccount={() => {}}
                        onCancelEditAccount={() => {}}
                        onAccountUpdate={async () => {}}
                        onPasswordResetRequest={async () => {}}
                        onDelete={async () => {}}
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              ))}
            </Tabs>
          )}
        </div>
      </div>
    );
  }

  // LEAD or OTHER contact
  return (
    <div className={`border-l dark:border-brand-dark-border p-6 ${className}`}>
      <div className="space-y-2">
        <h3 className="font-semibold">{contact.display_name || 'Unknown Contact'}</h3>
        <p className="text-sm text-muted-foreground">{contact.contact_type}</p>
        <div className="text-sm">
          <span className="font-medium text-muted-foreground">Phone:</span>{' '}
          <span>{contact.phone_e164}</span>
        </div>
      </div>
    </div>
  );
}

