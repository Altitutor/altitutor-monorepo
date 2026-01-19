'use client';

import { useState, useMemo } from 'react';
import { Button } from '@altitutor/ui';
import { Card } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import type { DraftClassPlanWithDetails } from '../api/classPlans';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';
import { CreateDraftClassModal } from './CreateDraftClassModal';
import { ClassBank } from './ClassBank';
import { AddSlotModal } from './AddSlotModal';
import { classPlansApi } from '../api/classPlans';
import { useQueryClient } from '@tanstack/react-query';
import { classPlansKeys } from '../hooks/useClassPlansQuery';
import { StudentAvatar } from '@/features/sessions/components/StudentAvatar';

interface WeekCalendarViewProps {
  plan: DraftClassPlanWithDetails;
  planId: string;
  selectedSubjectId?: string | null;
  dragSubjectId?: string | null;
  onStudentDragStart?: (subjectId: string) => void;
  onStudentDragEnd?: () => void;
}

// Monday first
const WEEKDAYS = [
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
];

const WEEKEND = [
  { value: 6, label: 'Saturday', short: 'Sat' },
  { value: 0, label: 'Sunday', short: 'Sun' },
];

export function WeekCalendarView({ plan, planId, selectedSubjectId, dragSubjectId, onStudentDragStart, onStudentDragEnd }: WeekCalendarViewProps) {
  const qc = useQueryClient();
  const [createClassModalOpen, setCreateClassModalOpen] = useState(false);
  const [addSlotModalOpen, setAddSlotModalOpen] = useState(false);
  const [addSlotDayOfWeek, setAddSlotDayOfWeek] = useState<number | undefined>();
  const [createClassDefaults, setCreateClassDefaults] = useState<{
    dayOfWeek?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    subjectId?: string | null;
  }>({});

  // Filter classes by selected subject
  const filteredClasses = useMemo(() => {
    if (!selectedSubjectId && !dragSubjectId) return plan.classes;
    const filterSubjectId = dragSubjectId || selectedSubjectId;
    return plan.classes.filter((cls) => cls.subject_id === filterSubjectId);
  }, [plan.classes, selectedSubjectId, dragSubjectId]);

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const grouped: Record<number, typeof plan.slots> = {};
    [...WEEKDAYS, ...WEEKEND].forEach((day) => {
      grouped[day.value] = plan.slots.filter((slot) => slot.day_of_week === day.value);
    });
    return grouped;
  }, [plan]);

  // Group classes by day and slot (using filtered classes)
  const classesByDaySlot = useMemo(() => {
    const grouped: Record<number, Record<string, typeof filteredClasses>> = {};
    [...WEEKDAYS, ...WEEKEND].forEach((day) => {
      grouped[day.value] = {};
      slotsByDay[day.value].forEach((slot) => {
        const slotKey = `${slot.start_time}-${slot.end_time}`;
        grouped[day.value][slotKey] = filteredClasses.filter(
          (cls) =>
            cls.day_of_week === day.value &&
            cls.start_time === slot.start_time &&
            cls.end_time === slot.end_time
        );
      });
    });
    return grouped;
  }, [filteredClasses, slotsByDay]);

  const handleCreateClass = async (dayOfWeek: number | null, startTime: string | null, endTime: string | null, subjectId?: string | null) => {
    const finalSubjectId = subjectId || selectedSubjectId || null;
    
    // If subject filter is selected, auto-create class without modal
    if (selectedSubjectId && finalSubjectId === selectedSubjectId) {
      try {
        await classPlansApi.createDraftClass(planId, {
          subject_id: finalSubjectId,
          day_of_week: dayOfWeek,
          start_time: startTime || null,
          end_time: endTime || null,
          room: null,
          level: null,
          status: 'ACTIVE',
        });
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
        return; // Success, don't show modal
      } catch (error) {
        console.error('Error auto-creating class:', error);
        // Fall back to modal on error
        setCreateClassDefaults({
          dayOfWeek: dayOfWeek || null,
          startTime: startTime || null,
          endTime: endTime || null,
          subjectId: finalSubjectId,
        });
        setCreateClassModalOpen(true);
        return;
      }
    }
    
    // Otherwise show modal
    setCreateClassDefaults({
      dayOfWeek: dayOfWeek || null,
      startTime: startTime || null,
      endTime: endTime || null,
      subjectId: finalSubjectId,
    });
    setCreateClassModalOpen(true);
  };

  const handleDragOver = (e: React.DragEvent, classSubjectId: string | null) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      // Handle student drag
      if (data.studentId) {
        const { subjectId } = data;
        // Only allow drop if subjects match or class has no subject
        if (subjectId && classSubjectId && subjectId !== classSubjectId) {
          e.dataTransfer.dropEffect = 'none';
          return;
        }
        e.dataTransfer.dropEffect = data.fromClassId ? 'move' : 'copy';
        return;
      }
      // Handle class drag
      if (data.classId) {
        e.dataTransfer.dropEffect = 'move';
        return;
      }
      e.dataTransfer.dropEffect = 'none';
    } catch {
      // Invalid drag data
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDrop = async (e: React.DragEvent, classId: string, classSubjectId: string | null) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      
      // Handle student drop
      if (data.studentId) {
        const { studentId, subjectId, fromClassId } = data;
        if (!studentId || !classId) return;
        
        // Only allow drop if subjects match or class has no subject
        if (subjectId && classSubjectId && subjectId !== classSubjectId) {
          return;
        }
        
        // If moving from another class, remove from old class first
        if (fromClassId && fromClassId !== classId) {
          await classPlansApi.removeStudentFromDraftClass(fromClassId, studentId);
        }
        
        // Add student to new class (only if not already in this class)
        const targetClass = plan.classes.find((c) => c.id === classId);
        if (targetClass && !targetClass.students.some((s) => s.id === studentId)) {
          await classPlansApi.addStudentToDraftClass(classId, studentId);
        }
        
        // Refresh plan data
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
        onStudentDragEnd?.();
      }
      
      // Handle class drop (moving class to different slot)
      if (data.classId) {
        const { classId: draggedClassId, dayOfWeek, startTime, endTime } = data;
        if (!draggedClassId || draggedClassId === classId) return;
        
        // Update class with new slot info
        await classPlansApi.updateDraftClass(draggedClassId, {
          day_of_week: dayOfWeek,
          start_time: startTime || undefined,
          end_time: endTime || undefined,
        });
        
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
      }
    } catch (error) {
      console.error('Error handling drop:', error);
    }
  };

  const handleClassDragStart = (e: React.DragEvent, cls: typeof plan.classes[0]) => {
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

  const handleSlotDragOver = (e: React.DragEvent, _dayOfWeek: number, _startTime: string, _endTime: string) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      // Allow drop if it's a class being dragged
      if (data.classId) {
        e.dataTransfer.dropEffect = 'move';
        return;
      }
      e.dataTransfer.dropEffect = 'none';
    } catch {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleSlotDrop = async (e: React.DragEvent, dayOfWeek: number, startTime: string, endTime: string) => {
    e.preventDefault();
    const dragData = e.dataTransfer.getData('application/json');
    if (!dragData) return;
    
    try {
      const data = JSON.parse(dragData);
      if (data.classId) {
        // Move class to this slot
        await classPlansApi.updateDraftClass(data.classId, {
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
        });
        
        qc.invalidateQueries({ queryKey: classPlansKeys.detail(planId) });
      }
    } catch (error) {
      console.error('Error moving class:', error);
    }
  };

  const renderDayColumn = (day: typeof WEEKDAYS[0] | typeof WEEKEND[0]) => {
    return (
      <div key={day.value} className="border rounded-lg p-2">
        <div className="font-semibold text-sm mb-2 sticky top-0 bg-background z-10 flex items-center justify-between">
          <span>{day.label}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => {
              setAddSlotDayOfWeek(day.value);
              setAddSlotModalOpen(true);
            }}
            title="Add slot"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-2">
          {slotsByDay[day.value].length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">
              No slots configured
            </div>
          ) : (
            slotsByDay[day.value].map((slot) => {
              const slotKey = `${slot.start_time}-${slot.end_time}`;
              const classes = classesByDaySlot[day.value]?.[slotKey] || [];
              return (
                <div
                  key={slotKey}
                  className="border rounded p-2 min-h-[100px] bg-muted/30"
                  onDragOver={(e) => handleSlotDragOver(e, day.value, slot.start_time, slot.end_time)}
                  onDrop={(e) => handleSlotDrop(e, day.value, slot.start_time, slot.end_time)}
                >
                  <div className="text-xs text-muted-foreground mb-1">
                    {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                  </div>
                  <div className="space-y-1">
                    {classes.map((cls) => {
                      const subject = cls.subject;
                      const { style } = subject
                        ? getSubjectColorStyle(subject)
                        : { style: {} as React.CSSProperties };
                      const borderColor = (style as any).borderColor || (style as any).backgroundColor || '#e5e7eb';
                      return (
                        <Card
                          key={cls.id}
                          className="p-2 text-xs cursor-move hover:shadow-md transition-shadow bg-background border-2"
                          style={{ borderColor }}
                          draggable
                          onDragStart={(e) => handleClassDragStart(e, cls)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            handleDragOver(e, cls.subject_id || null);
                          }}
                          onDrop={(e) => handleDrop(e, cls.id, cls.subject_id || null)}
                        >
                          <div className="font-medium text-foreground">
                            {subject ? formatSubjectDisplay(subject) : 'No Subject'}
                          </div>
                          {cls.level && (
                            <div className="text-xs text-muted-foreground">{cls.level}</div>
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
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-8 text-xs"
                      onClick={() => handleCreateClass(day.value, slot.start_time, slot.end_time, selectedSubjectId || undefined)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Class
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="p-4 h-full overflow-auto">
        {/* Monday - Friday Row */}
        <div className="grid grid-cols-5 gap-2 mb-2">
          {WEEKDAYS.map(renderDayColumn)}
        </div>

        {/* Saturday, Sunday + Class Bank Row */}
        <div className="grid grid-cols-3 gap-2">
          {WEEKEND.map(renderDayColumn)}
          <div className="border rounded-lg overflow-hidden">
            <ClassBank 
              planId={planId} 
              selectedSubjectId={selectedSubjectId}
              dragSubjectId={dragSubjectId}
              onCreateClass={() => {
                setCreateClassDefaults({
                  subjectId: selectedSubjectId || null,
                });
                setCreateClassModalOpen(true);
              }}
              onAutoCreateClass={async (subjectId: string) => {
                await handleCreateClass(null, null, null, subjectId);
              }}
              onStudentDragStart={onStudentDragStart}
              onStudentDragEnd={onStudentDragEnd}
            />
          </div>
        </div>
      </div>

      <CreateDraftClassModal
        isOpen={createClassModalOpen}
        onClose={() => {
          setCreateClassModalOpen(false);
          setCreateClassDefaults({});
        }}
        planId={planId}
        defaultDayOfWeek={createClassDefaults.dayOfWeek}
        defaultStartTime={createClassDefaults.startTime}
        defaultEndTime={createClassDefaults.endTime}
        defaultSubjectId={createClassDefaults.subjectId}
        defaultClassLength={plan.default_class_length_hours ?? 1.5}
      />

      <AddSlotModal
        isOpen={addSlotModalOpen}
        onClose={() => {
          setAddSlotModalOpen(false);
          setAddSlotDayOfWeek(undefined);
        }}
        planId={planId}
        defaultDayOfWeek={addSlotDayOfWeek}
        defaultClassLength={plan.default_class_length_hours ?? 1.5}
      />
    </>
  );
}
