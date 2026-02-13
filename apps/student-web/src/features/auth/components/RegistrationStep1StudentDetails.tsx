'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useSubjectsSearch, useSubjectSearchWithTerm } from '@/shared/hooks';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Plus, X, Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, cn, getSubjectColorStyle } from '@/shared/utils';

type RegistrationFormValues = {
  student: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    school?: string;
    curriculum?: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY';
    year_level?: number;
    subject_ids: string[];
  };
  parents: Array<{
    id?: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  }>;
  availability: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday_am: boolean;
    saturday_pm: boolean;
    sunday_am: boolean;
    sunday_pm: boolean;
  };
  password: string;
  confirmPassword?: string;
  paymentMethodVerified: boolean;
};

interface RegistrationStep1StudentDetailsProps {
  form: UseFormReturn<RegistrationFormValues>;
  initialSubjects: Array<{
    id: string;
    name: string;
    year_level: number | null;
    curriculum: string | null;
    color: string | null;
  }>;
}

export function RegistrationStep1StudentDetails({
  form,
  initialSubjects,
}: RegistrationStep1StudentDetailsProps) {
  const curriculum = form.watch('student.curriculum');
  const yearLevel = form.watch('student.year_level');
  const watchedSubjectIds = form.watch('student.subject_ids');
  const selectedSubjectIds = useMemo(() => watchedSubjectIds || [], [watchedSubjectIds]);

  // Helper functions to determine valid options
  const getYearLevelNum = (yearLevel: number | undefined): number | null => {
    if (yearLevel === undefined || yearLevel === null) return null;
    return yearLevel;
  };

  const getValidCurriculums = (yearLevel: number | undefined): Array<'SACE' | 'IB' | 'PRESACE' | 'PRIMARY'> => {
    const yearLevelNum = getYearLevelNum(yearLevel);
    if (yearLevelNum === null) return ['SACE', 'IB', 'PRESACE', 'PRIMARY'];
    
    if (yearLevelNum >= 11 && yearLevelNum <= 13) {
      return ['SACE', 'IB'];
    } else if (yearLevelNum >= 7 && yearLevelNum <= 10) {
      return ['PRESACE'];
    } else if (yearLevelNum >= 0 && yearLevelNum <= 6) {
      return ['PRIMARY'];
    }
    return ['SACE', 'IB', 'PRESACE', 'PRIMARY'];
  };

  const getValidYearLevels = (curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | undefined): number[] => {
    if (!curriculum) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
    
    if (curriculum === 'SACE' || curriculum === 'IB') {
      return [11, 12, 13];
    } else if (curriculum === 'PRESACE') {
      return [7, 8, 9, 10];
    } else if (curriculum === 'PRIMARY') {
      return [0, 1, 2, 3, 4, 5, 6];
    }
    return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  };

  const validCurriculums = useMemo(() => getValidCurriculums(yearLevel), [yearLevel]);
  const validYearLevels = useMemo(() => getValidYearLevels(curriculum), [curriculum]);

  // Ref to prevent infinite loops between curriculum and year level auto-selection
  const isAutoSelectingRef = useRef(false);

  // Auto-select curriculum when year level changes
  useEffect(() => {
    if (isAutoSelectingRef.current) return;
    if (yearLevel === undefined || yearLevel === null) return;
    
    const yearLevelNum = getYearLevelNum(yearLevel);
    if (yearLevelNum === null) return;

    const currentCurriculum = form.getValues('student.curriculum');
    let newCurriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | null = null;
    
    // Determine what curriculum should be selected based on year level
    if (yearLevelNum >= 11 && yearLevelNum <= 13) {
      if (currentCurriculum !== 'SACE' && currentCurriculum !== 'IB') {
        newCurriculum = 'SACE';
      }
    } else if (yearLevelNum >= 7 && yearLevelNum <= 10) {
      if (currentCurriculum !== 'PRESACE') {
        newCurriculum = 'PRESACE';
      }
    } else if (yearLevelNum >= 0 && yearLevelNum <= 6) {
      if (currentCurriculum !== 'PRIMARY') {
        newCurriculum = 'PRIMARY';
      }
    }
    
    // Only set if we need to change and we're not already auto-selecting
    if (newCurriculum && !isAutoSelectingRef.current) {
      isAutoSelectingRef.current = true;
      form.setValue('student.curriculum', newCurriculum, { shouldValidate: true });
      // Reset flag after React processes the update
      setTimeout(() => {
        isAutoSelectingRef.current = false;
      }, 0);
    }
  }, [yearLevel, form]);

  // Auto-select year level when curriculum changes
  useEffect(() => {
    if (isAutoSelectingRef.current) return;
    if (!curriculum) return;
    
    const currentYearLevel = form.getValues('student.year_level');
    const validYearLevelsForCurriculum = getValidYearLevels(curriculum);
    
    // If current year level is not valid for the selected curriculum, auto-select first valid option
    if (currentYearLevel !== undefined && !validYearLevelsForCurriculum.includes(currentYearLevel)) {
      const newYearLevel = validYearLevelsForCurriculum[0];
      // Only set if different and we're not already auto-selecting
      if (currentYearLevel !== newYearLevel && !isAutoSelectingRef.current) {
        isAutoSelectingRef.current = true;
        form.setValue('student.year_level', newYearLevel, { shouldValidate: true });
        // Reset flag after React processes the update
        setTimeout(() => {
          isAutoSelectingRef.current = false;
        }, 0);
      }
    }
  }, [curriculum, form]);

  // Subject search state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(subjectSearchQuery, 300);
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());

  // Initialize cache with initial subjects
  useEffect(() => {
    const cache = new Map<string, Tables<'subjects'>>();
    initialSubjects.forEach((s) => {
      cache.set(s.id, s as Tables<'subjects'>);
    });
    setSelectedSubjectsCache(cache);
  }, [initialSubjects]);

  // Fetch subjects filtered by curriculum/year level (React Query)
  const { data: subjectsFilteredData, isLoading: isLoadingFiltered } = useSubjectsSearch({
    curriculum: curriculum ?? null,
    yearLevel: yearLevel ?? null,
  });
  const allSubjects = subjectsFilteredData?.subjects ?? [];

  // Search by term when user types (ignores curriculum/year level)
  const { data: subjectsSearchData, isFetching: isSearchingByTerm } = useSubjectSearchWithTerm({
    searchTerm: debouncedSearchQuery,
    enabled: debouncedSearchQuery.trim().length > 0,
  });
  const subjectSearchResults =
    debouncedSearchQuery.trim().length > 0 ? (subjectsSearchData?.subjects ?? []) : allSubjects;

  const isSearchingSubjects = isLoadingFiltered || (isSearchingByTerm && debouncedSearchQuery.trim().length > 0);

  // Reset search when popover closes
  useEffect(() => {
    if (!isSubjectPopoverOpen) {
      setSubjectSearchQuery('');
    }
  }, [isSubjectPopoverOpen]);

  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjectIds);
    return subjectSearchResults.filter((s) => !selectedIds.has(s.id));
  }, [subjectSearchResults, selectedSubjectIds]);

  const selectedSubjects = useMemo(() => {
    if (!selectedSubjectIds || selectedSubjectIds.length === 0) return [];
    const subjects: Tables<'subjects'>[] = [];
    const allAvailableSubjects = [...allSubjects, ...subjectSearchResults];
    const uniqueSubjectsMap = new Map(allAvailableSubjects.map(s => [s.id, s]));
    const mergedMap = new Map([...selectedSubjectsCache, ...uniqueSubjectsMap]);
    
    selectedSubjectIds.forEach(id => {
      const subject = mergedMap.get(id);
      if (subject) subjects.push(subject);
    });
    
    return subjects;
  }, [selectedSubjectIds, allSubjects, subjectSearchResults, selectedSubjectsCache]);

  const handleSelectSubject = (subject: Tables<'subjects'>) => {
    const currentIds = form.getValues('student.subject_ids') || [];
    form.setValue('student.subject_ids', [...currentIds, subject.id]);
    setSelectedSubjectsCache(prev => new Map(prev).set(subject.id, subject));
    setIsSubjectPopoverOpen(false);
    setSubjectSearchQuery('');
  };

  const handleRemoveSubject = (subjectId: string) => {
    const currentIds = form.getValues('student.subject_ids') || [];
    form.setValue('student.subject_ids', currentIds.filter(id => id !== subjectId));
    setSelectedSubjectsCache(prev => {
      const newMap = new Map(prev);
      newMap.delete(subjectId);
      return newMap;
    });
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Student Details</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="student.first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student First Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="student.last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student Last Name *</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="student.email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student Email *</FormLabel>
              <FormControl>
                <Input type="email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="student.phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Student Phone *</FormLabel>
              <FormControl>
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  error={form.formState.errors.student?.phone?.message}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="student.school"
        render={({ field }) => (
          <FormItem>
            <FormLabel>School</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="student.year_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year Level *</FormLabel>
              <div className="relative">
                <Select
                  value={field.value === 0 ? 'Reception' : field.value?.toString() || ""}
                  onValueChange={(value) => {
                    field.onChange(value === 'Reception' || value === "" ? (value === "" ? undefined : 0) : parseInt(value, 10));
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={cn(field.value !== undefined && "pr-10 [&_svg]:hidden")}>
                      <SelectValue placeholder="Select year level" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {validYearLevels.map((year) => (
                      <SelectItem key={year} value={year === 0 ? 'Reception' : year.toString()}>
                        {year === 0 ? 'Reception' : `Year ${year}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.value !== undefined && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentCurriculum = form.getValues('student.curriculum');
                      form.setValue('student.year_level', undefined as any, { shouldValidate: true });
                      // If curriculum requires a year level, clear it too
                      if (currentCurriculum && getValidYearLevels(currentCurriculum).length > 0) {
                        form.setValue('student.curriculum', undefined as any, { shouldValidate: true });
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="student.curriculum"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Curriculum *</FormLabel>
              <div className="relative">
                <Select
                  value={field.value || ""}
                  onValueChange={(value) => {
                    field.onChange(value === "" ? undefined : value);
                  }}
                >
                  <FormControl>
                    <SelectTrigger className={cn(field.value && "pr-10 [&_svg]:hidden")}>
                      <SelectValue placeholder="Select curriculum" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {validCurriculums.map((curr) => (
                      <SelectItem key={curr} value={curr}>
                        {curr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.value && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const currentYearLevel = form.getValues('student.year_level');
                      form.setValue('student.curriculum', undefined as any, { shouldValidate: true });
                      // If year level requires a curriculum, clear it too
                      if (currentYearLevel !== undefined) {
                        const validCurriculumsForYear = getValidCurriculums(currentYearLevel);
                        if (validCurriculumsForYear.length > 0 && validCurriculumsForYear.length < 4) {
                          form.setValue('student.year_level', undefined as any, { shouldValidate: true });
                        }
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded-sm opacity-70 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Subjects */}
      <FormField
        control={form.control}
        name="student.subject_ids"
        render={() => (
          <FormItem>
            <FormLabel>Subjects *</FormLabel>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedSubjects.map((subject) => {
                  const { style, textColorClass } = getSubjectColorStyle(subject);
                  const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                  return (
                    <Badge
                      key={subject.id}
                      className={cn(defaultClass || `${textColorClass} border-0`, !defaultClass && 'border-0')}
                      style={style.backgroundColor ? style : undefined}
                    >
                      {formatSubjectDisplay(subject)}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubject(subject.id)}
                        className="ml-2 hover:opacity-70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
              <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Subject
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <div className="p-3 border-b">
                    <Input
                      placeholder="Search subjects..."
                      value={subjectSearchQuery}
                      onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-64">
                    {isSearchingSubjects ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : availableSubjects.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        No subjects found
                      </div>
                    ) : (
                      <div className="p-2">
                        {availableSubjects.map((subject) => (
                          <button
                            key={subject.id}
                            type="button"
                            onClick={() => handleSelectSubject(subject)}
                            className="w-full text-left p-2 hover:bg-muted rounded text-sm"
                          >
                            {formatSubjectDisplay(subject)}
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
