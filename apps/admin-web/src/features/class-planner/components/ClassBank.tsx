'use client';

import { useMemo } from 'react';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { Card } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { getSubjectColorStyle } from '@/shared/utils';
import { StudentAvatar } from '@/features/sessions/components/StudentAvatar';
import { classPlansApi } from '../api/classPlans';
import { useQueryClient } from '@tanstack/react-query';
import { classPlansKeys } from '../hooks/useClassPlansQuery';

interface ClassBankProps {
  planId: string;
  onCreateClass?: () => void;
  selectedSubjectId?: string | null;
  dragSubjectId?: string | null;
  onAutoCreateClass?: (subjectId: string) => Promise<void>;
  onStudentDragStart?: (subjectId: string) => void;
  onStudentDragEnd?: () => void;
}

export function ClassBank({ planId, onCreateClass, selectedSubjectId, dragSubjectId, onAutoCreateClass, onStudentDragStart, onStudentDragEnd }: ClassBankProps) {
  const qc = useQueryClient();
  const { data: plan } = useClassPlan(planId);

  const handleClassDragStart = (e: React.DragEvent, cls: NonNullable<typeof plan>['classes'][0]) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        classId: cls.id,
        dayOfWeek: cls.day_of_week,
        startTime: cls.start_time,
        endTime: cls.end_time,
      })
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      if (data.classId) {
        e.dataTransfer.dropEffect = 'move';
      } else if (data.studentId && data.fromClassId) {
        // Allow dropping students back to bank (to remove from class)
        e.dataTransfer.dropEffect = 'move';
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    } catch {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      if (data.classId) {
        // Move class to bank (unassign) - use empty strings to unassign
        await classPlansApi.updateDraftClass(data.classId, {
          day_of_week: null,
          start_time: '',
          end_time: '',
        });
        
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
      } else if (data.studentId && data.fromClassId) {
        // Remove student from class (dropped back to bank)
        await classPlansApi.removeStudentFromDraftClass(data.fromClassId, data.studentId);
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
        onStudentDragEnd?.();
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  // Get unassigned classes (no day_of_week or start_time/end_time)
  const unassignedClasses = useMemo(() => {
    if (!plan) return [];
    let classes = plan.classes.filter(
      (cls) =>
        cls.day_of_week === null ||
        cls.start_time === null ||
        cls.end_time === null
    );
    
    // Filter by subject if selected or dragging
    const filterSubjectId = dragSubjectId || selectedSubjectId;
    if (filterSubjectId) {
      classes = classes.filter((cls) => cls.subject_id === filterSubjectId);
    }
    
    return classes;
  }, [plan, selectedSubjectId, dragSubjectId]);

  if (!plan) return null;

  return (
    <div 
      className="p-4 h-full flex flex-col overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <h3 className="text-sm font-semibold">Class Bank</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {unassignedClasses.length} class{unassignedClasses.length !== 1 ? 'es' : ''}
          </span>
          {onCreateClass && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (selectedSubjectId && onAutoCreateClass) {
                  try {
                    await onAutoCreateClass(selectedSubjectId);
                  } catch (error) {
                    console.error('Error auto-creating class:', error);
                    onCreateClass();
                  }
                } else {
                  onCreateClass();
                }
              }}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Create
            </Button>
          )}
        </div>
      </div>
      
      {unassignedClasses.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground flex-1 flex items-center justify-center overflow-y-auto">
          <div>
            <p>No unassigned classes.</p>
            {onCreateClass && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (selectedSubjectId && onAutoCreateClass) {
                    try {
                      await onAutoCreateClass(selectedSubjectId);
                    } catch (error) {
                      console.error('Error auto-creating class:', error);
                      onCreateClass();
                    }
                  } else {
                    onCreateClass();
                  }
                }}
                className="mt-2"
              >
                <Plus className="h-3 w-3 mr-1" />
                Create Class
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 min-h-0">
          {unassignedClasses.map((cls) => {
            const subject = cls.subject;
            const { style } = subject
              ? getSubjectColorStyle(subject)
              : { style: {} as React.CSSProperties };
            const styleObj = style as React.CSSProperties;
            const borderColor = styleObj.borderColor ?? styleObj.backgroundColor ?? '#e5e7eb';
            
            return (
              <Card
                key={cls.id}
                className="p-3 w-full cursor-move hover:shadow-md transition-shadow bg-background border-2"
                style={{ borderColor }}
                draggable
                onDragStart={(e) => handleClassDragStart(e, cls)}
                onDragOver={(e) => {
                  e.preventDefault();
                  // Allow drop if it's a JSON data type (student drag)
                  // Subject matching will be checked in onDrop
                  if (e.dataTransfer.types.includes('application/json')) {
                    e.dataTransfer.dropEffect = 'move';
                  } else {
                    e.dataTransfer.dropEffect = 'none';
                  }
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  const dragData = e.dataTransfer.getData('application/json');
                  if (!dragData) return;
                  
                  try {
                    const data = JSON.parse(dragData);
                    if (data.studentId) {
                      const { studentId, subjectId, fromClassId } = data;
                      if (!studentId || !cls.id) return;
                      
                      // Only allow drop if subjects match or class has no subject
                      if (subjectId && cls.subject_id && subjectId !== cls.subject_id) {
                        return;
                      }
                      
                      // If moving from another class, remove from old class first
                      if (fromClassId && fromClassId !== cls.id) {
                        await classPlansApi.removeStudentFromDraftClass(fromClassId, studentId);
                      }
                      
                      // Add student to new class (only if not already in this class)
                      if (!cls.students.some((s) => s.id === studentId)) {
                        await classPlansApi.addStudentToDraftClass(cls.id, studentId);
                      }
                      
                      qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
                      onStudentDragEnd?.();
                    }
                  } catch (error) {
                    console.error('Error moving student to class:', error);
                  }
                }}
              >
                <div className="font-medium text-sm text-foreground">
                  {subject?.long_name ?? 'No Subject'}
                </div>
                {cls.level && (
                  <div className="text-xs text-muted-foreground mt-1">{cls.level}</div>
                )}
                {cls.students.length > 0 && (
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {cls.students.map((student) => (
                      <div
                        key={student.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            'application/json',
                            JSON.stringify({
                              studentId: student.id,
                              subjectId: cls.subject_id,
                              fromClassId: cls.id,
                            })
                          );
                          if (cls.subject_id) {
                            onStudentDragStart?.(cls.subject_id);
                          }
                        }}
                        onDragEnd={() => {
                          onStudentDragEnd?.();
                        }}
                        className="cursor-move"
                      >
                        <StudentAvatar
                          student={student}
                          size="sm"
                          showTooltip={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
