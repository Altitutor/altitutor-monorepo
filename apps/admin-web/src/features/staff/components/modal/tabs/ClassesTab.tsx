import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tables, TablesUpdate } from "@altitutor/shared";
import { Button } from "@altitutor/ui";
import { SegmentedControl } from "@altitutor/ui";
import { Badge } from "@altitutor/ui";
import { Separator } from "@altitutor/ui";
import { useToast } from "@altitutor/ui";
import { Loader2, Plus, Pencil, X } from "lucide-react";
import { classesApi } from '@/shared/api';
import { ViewClassModal, CalendarView } from '@/features/classes';
import { ClassCard } from '@/shared/components/ClassCard';
import { AvailabilityFields, type AvailabilitySlotKey } from '@/shared/components/AvailabilityFields';
import { useStaffClasses, type StaffClass } from '@/features/staff/hooks/useStaffClasses';
import { useClassesWithDetails } from '@/features/classes/hooks/useClassesQuery';
import { useStaffWithSubjectsById } from '@/features/staff/hooks/useStaffQuery';
import { useCurrentStaff } from '@/shared/hooks';
import { staffApi } from '@/features/staff/api/staff';
import { SubjectSearchPopover } from '@/features/subjects/components/SubjectSearchPopover';
import { useSubjectsList } from '@/features/subjects/hooks/useSubjectsQuery';
import { getSubjectColorStyle } from '@/shared/utils';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { AssignStaffModal } from '@/features/enrollments';
import { invalidateStaffDetail } from '@/shared/lib/query-invalidation';

type ViewMode = 'table' | 'calendar';

interface ClassesTabProps {
  staff: Tables<'staff'>;
  onStaffUpdated?: () => void;
}

type StaffAvailabilityDraft = Pick<
  TablesUpdate<'staff'>,
  AvailabilitySlotKey
>;

function availabilityFromStaff(staff: Tables<'staff'>): StaffAvailabilityDraft {
  return {
    availability_monday: Boolean(staff.availability_monday),
    availability_tuesday: Boolean(staff.availability_tuesday),
    availability_wednesday: Boolean(staff.availability_wednesday),
    availability_thursday: Boolean(staff.availability_thursday),
    availability_friday: Boolean(staff.availability_friday),
    availability_saturday_am: Boolean(staff.availability_saturday_am),
    availability_saturday_pm: Boolean(staff.availability_saturday_pm),
    availability_sunday_am: Boolean(staff.availability_sunday_am),
    availability_sunday_pm: Boolean(staff.availability_sunday_pm),
    drafting_availability: Boolean(staff.drafting_availability),
    trial_session_availability: Boolean(staff.trial_session_availability),
    subsidy_interview_availability: Boolean(staff.subsidy_interview_availability),
  };
}

const sortClasses = (classes: StaffClass[]): StaffClass[] => {
  return [...classes].sort((a, b) => {
    const dayA = a.class.day_of_week === 0 ? 7 : a.class.day_of_week;
    const dayB = b.class.day_of_week === 0 ? 7 : b.class.day_of_week;
    
    if (dayA !== dayB) {
      return dayA - dayB;
    }
    
    return a.class.start_time.localeCompare(b.class.start_time);
  });
};

export function ClassesTab({
  staff,
  onStaffUpdated
}: ClassesTabProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: classesData = [], isLoading, error } = useStaffClasses(staff.id);
  const { data: allClassesWithDetailsData } = useClassesWithDetails();
  const { data: staffWithSubjects } = useStaffWithSubjectsById(staff.id);
  
  const allClasses = useMemo(() => {
    if (!allClassesWithDetailsData) return [];
    const { classes, classSubjects, classStaff, classStudents } = allClassesWithDetailsData;
    return sortClasses(classes.map(cls => ({
      class: cls,
      subject: classSubjects[cls.id],
      staff: classStaff[cls.id] || [],
      studentCount: (classStudents[cls.id] || []).length
    })));
  }, [allClassesWithDetailsData]);
  
  const classes = useMemo(() => sortClasses(classesData), [classesData]);
  const staffSubjects = useMemo(() => (staffWithSubjects?.subjects || []) as Tables<'subjects'>[], [staffWithSubjects?.subjects]);
  
  const [assigningClasses] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [isEditMode, setIsEditMode] = useState(false);
  const [availability, setAvailability] = useState<StaffAvailabilityDraft>(() => availabilityFromStaff(staff));
  const { data: subjectsListData } = useSubjectsList({ limit: 100, offset: 0 });
  const initialFilteredSubjects = subjectsListData?.subjects ?? [];

  useEffect(() => {
    if (!isEditMode) {
      setAvailability(availabilityFromStaff(staff));
    }
  }, [staff, isEditMode]);
  
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  
  const { data: currentStaff } = useCurrentStaff();

  const handleCloseAssignModal = useCallback(() => {
    setIsAssignStaffModalOpen(false);
  }, []);
  
  const timetableClasses = classes.map(c => c.class);
  const timetableSubjects: Record<string, Tables<'subjects'>> = {};
  const timetableStaff: Record<string, Tables<'staff'>[]> = {};
  classes.forEach(c => {
    if (c.subject) {
      timetableSubjects[c.class.id] = c.subject;
    }
    timetableStaff[c.class.id] = c.staff;
  });

  const handleAssignStaff = useCallback(async (params: {
    staffId: string;
    classId: string;
    assignedAt: Date;
    currentStaffId: string;
  }) => {
    try {
      await classesApi.assignStaff(params.classId, params.staffId, params.currentStaffId);
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['classes', 'withDetails'] });
      onStaffUpdated?.();
      
      toast({
        title: "Success",
        description: "Staff assigned to class successfully.",
      });
    } catch (error) {
      console.error('Failed to assign to class:', error);
      toast({
        title: "Assignment failed",
        description: "There was an error assigning the staff member to the class. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  }, [staff.id, queryClient, onStaffUpdated, toast]);

  const handleClassClick = (classId: string) => {
    setSelectedClassId(classId);
    setIsClassModalOpen(true);
  };

  const handleUnassign = async (classId: string) => {
    try {
      await classesApi.unassignStaff(classId, staff.id, currentStaff?.id);
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      await queryClient.invalidateQueries({ queryKey: ['classes', 'withDetails'] });
      onStaffUpdated?.();
      toast({
        title: 'Success',
        description: 'Staff unassigned from class.',
      });
    } catch (error) {
      console.error('Failed to unassign staff:', error);
      toast({
        title: 'Unassign failed',
        description: 'There was an error unassigning this staff member. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleAddSubject = async (subject: Tables<'subjects'>) => {
    try {
      await staffApi.assignSubjectToStaff(staff.id, subject.id);
      await invalidateStaffDetail(queryClient, staff.id);
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      onStaffUpdated?.();
      toast({
        title: 'Success',
        description: 'Subject added successfully.',
      });
    } catch (error) {
      console.error('Failed to add subject:', error);
      toast({
        title: 'Add failed',
        description: 'There was an error adding the subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveSubject = async (subjectId: string) => {
    try {
      await staffApi.removeSubjectFromStaff(staff.id, subjectId);
      await invalidateStaffDetail(queryClient, staff.id);
      await queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
      onStaffUpdated?.();
      toast({
        title: 'Success',
        description: 'Subject removed successfully.',
      });
    } catch (error) {
      console.error('Failed to remove subject:', error);
      toast({
        title: 'Remove failed',
        description: 'There was an error removing the subject. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCancelEdit = () => {
    setAvailability(availabilityFromStaff(staff));
    setIsEditMode(false);
  };

  const handleSave = async () => {
    try {
      await staffApi.updateStaff(staff.id, {
        first_name: staff.first_name,
        last_name: staff.last_name,
        email: staff.email,
        phone_number: staff.phone_number,
        birthday: staff.birthday,
        role: staff.role,
        status: staff.status,
        notes: staff.notes,
        office_key_number: staff.office_key_number,
        has_parking_remote: staff.has_parking_remote,
        ...availability,
      });
      await invalidateStaffDetail(queryClient, staff.id);
      onStaffUpdated?.();
      setIsEditMode(false);
      toast({
        title: 'Success',
        description: 'Availability updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update availability:', error);
      toast({
        title: 'Update failed',
        description: 'There was an error updating availability. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const renderClassCard = (staffClass: StaffClass, keyPrefix = '') => {
    const students = allClassesWithDetailsData?.classStudents?.[staffClass.class.id] || [];
    return (
      <ClassCard
        key={`${keyPrefix}${staffClass.class.id}`}
        class={staffClass.class}
        subject={staffClass.subject}
        staff={staffClass.staff}
        students={students}
        onClick={keyPrefix ? undefined : () => handleClassClick(staffClass.class.id)}
        onUnassign={keyPrefix ? undefined : () => void handleUnassign(staffClass.class.id)}
      />
    );
  };

  const addSubjectPill = (
    <SubjectSearchPopover
      selectedSubjects={staffSubjects}
      onSelectSubject={handleAddSubject}
      initialSubjects={initialFilteredSubjects}
      trigger={
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border-2 border-dashed border-muted-foreground/40 bg-transparent px-2.5 py-0.5 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
          Add subject
        </button>
      }
    />
  );

  const classesByDay = useMemo(() => {
    const grouped: Record<string, StaffClass[]> = {};
    classes.forEach((classData) => {
      const day = getDayOfWeek(classData.class.day_of_week);
      if (!grouped[day]) grouped[day] = [];
      grouped[day].push(classData);
    });
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return Object.keys(grouped)
      .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b))
      .map((day) => ({ day, classes: grouped[day] }));
  }, [classes]);

  if (isLoading) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex justify-center items-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">Failed to load classes</p>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] })}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 h-full min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="space-y-5 mb-6">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-semibold">Availability</h3>
                {!isEditMode && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
              <AvailabilityFields
                isEditing={isEditMode}
                getValue={(key) => Boolean(
                  isEditMode ? availability[key] : staff[key]
                )}
                onCheckedChange={(key, checked) => {
                  setAvailability((current) => ({ ...current, [key]: checked }));
                }}
                showSessionTypes
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <h3 className="text-base font-medium">Subjects</h3>
              <div className="flex flex-wrap gap-2">
                {staffSubjects.length > 0 ? (
                  staffSubjects.map((subject) => {
                    const shortName = subject?.short_name ?? subject?.long_name ?? subject?.name ?? '';
                    const { style, textColorClass } = getSubjectColorStyle(subject);
                    const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                    return (
                      <Badge
                        key={subject.id}
                        className={defaultClass || `${textColorClass} cursor-pointer hover:opacity-80 flex items-center gap-1 pr-1`}
                        style={style.backgroundColor ? style : undefined}
                      >
                        <span>{shortName}</span>
                        {isEditMode && (
                          <button
                            type="button"
                            className="ml-1 rounded-full hover:bg-black/20 p-0.5 flex items-center justify-center"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleRemoveSubject(subject.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No subjects assigned</p>
                )}
                {addSubjectPill}
              </div>
            </div>
            <Separator />
          </div>

          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium">Classes {classes.length > 0 ? `(${classes.length})` : ''}</h3>
              {assigningClasses.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Assigning to {assigningClasses.size} class{assigningClasses.size > 1 ? 'es' : ''}...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SegmentedControl
                value={viewMode}
                onValueChange={(v) => setViewMode(v as ViewMode)}
                options={[
                  { value: 'table', label: 'Table' },
                  { value: 'calendar', label: 'Calendar' },
                ]}
              />
              {currentStaff && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setIsAssignStaffModalOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Class</span>
                </Button>
              )}
            </div>
          </div>

          {viewMode === 'table' ? (
                <div className="space-y-6 pb-6">
                  {Array.from(assigningClasses).map((classId) => {
                    const classData = allClasses.find((c) => c.class.id === classId);
                    if (!classData) return null;
                    return renderClassCard(classData, 'assigning-');
                  })}
                  {classes.length === 0 && assigningClasses.size === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      This staff member is not currently assigned to any classes.
                    </p>
                  ) : (
                    classesByDay.map(({ day, classes: dayClasses }) => (
                      <div key={day}>
                        <h4 className="text-sm font-semibold mb-2">{day}</h4>
                        <div className="space-y-2">
                          {dayClasses.map((staffClass) => renderClassCard(staffClass))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
            ) : (
              <div className="h-[min(70dvh,640px)] min-h-[360px]">
                <CalendarView
                  classes={timetableClasses}
                  classSubjects={timetableSubjects}
                  classStaff={timetableStaff}
                  onClassClick={(cls) => handleClassClick(cls.id)}
                  showFilters={false}
                />
              </div>
            )}
        </div>

        {isEditMode && (
          <div className="sticky bottom-0 left-0 right-0 p-6 border-t bg-background mt-auto shrink-0">
            <div className="flex w-full justify-end">
              <div className="flex space-x-2">
                <Button variant="outline" type="button" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button variant="default" onClick={() => void handleSave()}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

        {selectedClassId && (
          <ViewClassModal
            classId={selectedClassId}
            isOpen={isClassModalOpen}
            onClose={() => {
              setIsClassModalOpen(false);
              setSelectedClassId(null);
            }}
            onClassUpdated={() => {
              void queryClient.invalidateQueries({ queryKey: ['staff', staff.id, 'classes'] });
              void queryClient.invalidateQueries({ queryKey: ['classes', 'withDetails'] });
            }}
          />
        )}
      </div>

      {currentStaff && (
        <AssignStaffModal
          isOpen={isAssignStaffModalOpen}
          onClose={handleCloseAssignModal}
          context="staff"
          staff={staff}
          staffSubjects={staffSubjects}
          assignedClassIds={classes.map(c => c.class.id)}
          onAssign={handleAssignStaff}
          currentStaffId={currentStaff.id}
        />
      )}
    </>
  );
}
