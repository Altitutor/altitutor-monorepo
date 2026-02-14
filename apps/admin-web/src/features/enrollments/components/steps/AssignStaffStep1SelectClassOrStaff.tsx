'use client';

import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { StaffCard } from '@/shared/components/StaffCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { getDayOfWeek } from '@/shared/utils/datetime';
import { formatClassName, cn } from '@/shared/utils';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { AssignStaffContext, StaffConflictInfo, ClassConflictInfo, StaffUnavailabilityInfo } from '../../types/enrollment';

function staffDisplayName(s: Tables<'staff'>): string {
  return [s.first_name, s.last_name].filter(Boolean).join(' ') || 'Staff';
}

interface AssignStaffStep1SelectClassOrStaffProps {
  context: AssignStaffContext;
  isFetching: boolean;
  
  // Class context props
  classData?: Tables<'classes'>;
  classSubject?: Tables<'subjects'>;
  classStaff?: Tables<'staff'>[];
  
  // Staff context props
  staff?: Tables<'staff'>;
  staffSubjects?: Tables<'subjects'>[];
  
  // Data
  filteredClasses: ClassWithExpandedSubject[];
  filteredStaff: Tables<'staff'>[];
  availableDays: number[];
  
  // Selection
  selectedClassIds: string[];
  selectedStaffIds: string[];
  onToggleClass: (classId: string) => void;
  onToggleStaff: (staffId: string) => void;
  
  // Filters
  searchQuery: string;
  dayFilters: number[];
  subjectFilters: string[];
  onSearchChange: (query: string) => void;
  onToggleDay: (day: number) => void;
  onToggleSubject: (subjectId: string) => void;
  onClearFilters: () => void;
  
  // Conflicts
  staffConflicts: Map<string, StaffConflictInfo>;
  classConflicts: Map<string, ClassConflictInfo>;
  staffUnavailability: Map<string, StaffUnavailabilityInfo>;
  classUnavailability: Map<string, StaffUnavailabilityInfo>;
}

export function AssignStaffStep1SelectClassOrStaff({
  context,
  isFetching,
  classData,
  classSubject,
  classStaff: _classStaff,
  staff,
  staffSubjects: _staffSubjects,
  filteredClasses,
  filteredStaff,
  availableDays,
  selectedClassIds,
  selectedStaffIds,
  onToggleClass,
  onToggleStaff,
  searchQuery,
  dayFilters,
  subjectFilters: _subjectFilters,
  onSearchChange,
  onToggleDay,
  onToggleSubject: _onToggleSubject,
  onClearFilters,
  staffConflicts,
  classConflicts,
  staffUnavailability,
  classUnavailability,
}: AssignStaffStep1SelectClassOrStaffProps) {
  // Selected items for the card
  const selectedClasses = filteredClasses.filter(c => selectedClassIds.includes(c.id));
  const selectedStaff = filteredStaff.filter(s => selectedStaffIds.includes(s.id));

  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      {/* Info Card: Assign {staff member(s)} to {class} */}
      <div className="mb-4 p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium flex flex-wrap items-center gap-x-1 gap-y-2">
          Assign{' '}
          {context === 'staff' ? (
            staff ? (
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
                "bg-primary/10 text-primary border-primary/20"
              )}>
                {staffDisplayName(staff)}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20">
                choose staff
              </span>
            )
          ) : (
            <>
              {selectedStaff.length > 0 ? (
                selectedStaff.map((s) => (
                  <span
                    key={s.id}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold border",
                      "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {staffDisplayName(s)}
                    <button
                      type="button"
                      onClick={() => onToggleStaff(s.id)}
                      className="rounded p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      aria-label={`Remove ${staffDisplayName(s)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20">
                  choose staff
                </span>
              )}
            </>
          )}{' '}
          to{' '}
          {context === 'class' ? (
            classData && classSubject ? (
              <span className={cn(
                "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
                "bg-primary/10 text-primary border-primary/20"
              )}>
                {formatClassName(classData, classSubject)}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20">
                choose class
              </span>
            )
          ) : (
            <>
              {selectedClasses.length > 0 ? (
                selectedClasses.map((c) => (
                  <span
                    key={c.id}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md font-semibold border",
                      "bg-primary/10 text-primary border-primary/20"
                    )}
                  >
                    {formatClassName(c, c.subject)}
                    <button
                      type="button"
                      onClick={() => onToggleClass(c.id)}
                      className="rounded p-0.5 hover:bg-primary/20 focus:outline-none focus:ring-2 focus:ring-primary/40"
                      aria-label={`Remove ${formatClassName(c, c.subject)}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))
              ) : (
                <span className="inline-flex items-center px-2 py-1 rounded-md font-semibold border bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20">
                  choose class
                </span>
              )}
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={context === 'class' ? 'Search staff...' : 'Search classes...'}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Filters */}
      {context === 'staff' && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span>Filters:</span>
          </div>
          
          {/* Day Filter */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Day {dayFilters.length > 0 && `(${dayFilters.length})`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <div className="font-medium text-sm">Days</div>
                <div className="space-y-2">
                  {availableDays.map(day => (
                    <label key={day} className="flex items-center space-x-2 cursor-pointer">
                      <Checkbox
                        checked={dayFilters.includes(day)}
                        onCheckedChange={() => onToggleDay(day)}
                      />
                      <span className="text-sm">{getDayOfWeek(day)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Clear Filters */}
          {(dayFilters.length > 0 || searchQuery.trim()) && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs" 
              onClick={onClearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : context === 'class' ? (
          <div className="space-y-2">
            {filteredStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No staff found
              </p>
            ) : (
              filteredStaff.map((s) => {
                const conflictInfo = classConflicts.get(s.id);
                const unavailabilityInfo = classUnavailability.get(s.id);
                const hasConflict = !!conflictInfo;
                const isUnavailable = !!unavailabilityInfo;
                const isSelected = selectedStaffIds.includes(s.id);
                
                return (
                  <div key={s.id} className="relative">
                    {hasConflict && conflictInfo && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none">
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                          Conflict with {conflictInfo.conflictingStaff.first_name} {conflictInfo.conflictingStaff.last_name}
                        </div>
                      </div>
                    )}
                    {isUnavailable && unavailabilityInfo && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                          {unavailabilityInfo.staffName} is unavailable on {getDayOfWeek(unavailabilityInfo.dayOfWeek)}
                        </div>
                      </div>
                    )}
                    <StaffCard
                      staff={s}
                      subjects={[]}
                      isSelecting
                      isSelected={isSelected}
                      onClick={() => onToggleStaff(s.id)}
                    />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No classes found
              </p>
            ) : (
              filteredClasses.map((c) => {
                const conflictInfo = staffConflicts.get(c.id);
                const unavailabilityInfo = staffUnavailability.get(c.id);
                const hasConflict = !!conflictInfo;
                const isUnavailable = !!unavailabilityInfo;
                const isSelected = selectedClassIds.includes(c.id);
                
                return (
                  <div key={c.id} className="relative">
                    {hasConflict && conflictInfo && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none">
                        <div className="bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                          Conflict with {formatClassName(
                            {
                              id: conflictInfo.conflictingClass.id,
                              day_of_week: conflictInfo.conflictingClass.day_of_week,
                              start_time: conflictInfo.conflictingClass.start_time,
                              end_time: conflictInfo.conflictingClass.end_time,
                            } as Tables<'classes'>,
                            conflictInfo.conflictingClass.subject || null
                          )}
                        </div>
                      </div>
                    )}
                    {isUnavailable && unavailabilityInfo && (
                      <div className="absolute bottom-2 left-2 right-2 z-20 pointer-events-none">
                        <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded shadow-sm">
                          {unavailabilityInfo.staffName} is unavailable on {getDayOfWeek(unavailabilityInfo.dayOfWeek)}
                        </div>
                      </div>
                    )}
                    <ClassCard
                      class={c}
                      subject={c.subject}
                      staff={c.staff || []}
                      students={c.students || []}
                      isSelecting
                      isSelected={isSelected}
                      onClick={() => onToggleClass(c.id)}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

