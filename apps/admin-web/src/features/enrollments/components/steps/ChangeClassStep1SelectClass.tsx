'use client';

import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { ClassCard } from '@/shared/components/ClassCard';
import { getDayOfWeek } from '@/shared/utils/datetime';
import type { ClassWithExpandedSubject } from '@altitutor/shared';

interface ChangeClassStep1SelectClassProps {
  isFetching: boolean;
  filteredClasses: ClassWithExpandedSubject[];
  selectedNewClassId: string | null;
  searchQuery: string;
  dayFilters: number[];
  availableDays: number[];
  onSearchChange: (query: string) => void;
  onToggleDay: (day: number) => void;
  onClearFilters: () => void;
  onSelectClass: (classId: string) => void;
}

export function ChangeClassStep1SelectClass({
  isFetching,
  filteredClasses,
  selectedNewClassId,
  searchQuery,
  dayFilters,
  availableDays,
  onSearchChange,
  onToggleDay,
  onClearFilters,
  onSelectClass,
}: ChangeClassStep1SelectClassProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 space-y-4">
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by day, time, staff, or student..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
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

      <div className="flex-1 overflow-y-auto min-h-0">
        {isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No alternative classes found for this subject
          </p>
        ) : (
          <div className="space-y-2 pr-4">
            {filteredClasses.map((c) => (
              <ClassCard
                key={c.id}
                class={c}
                subject={c.subject}
                staff={c.staff || []}
                students={c.students}
                isSelecting
                isSelected={selectedNewClassId === c.id}
                onClick={() => onSelectClass(c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

