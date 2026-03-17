'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSubjectsSearch, useSubjectSearchWithTerm } from '@/shared/hooks';
import { useDebounce } from '@/shared/hooks/useDebounce';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Plus, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, cn, getSubjectColorStyle } from '@/shared/utils';

const trialContactSchema = z.object({
  student_first_name: z.string().min(1, 'First name is required').max(100),
  student_last_name: z.string().min(1, 'Last name is required').max(100),
  student_email: z.string().email('Invalid email address'),
  student_phone: z.string().min(1, 'Phone number is required'),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY'], {
    required_error: 'Please select a curriculum',
  }),
  year_level: z.enum(['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'], {
    required_error: 'Please select a year level',
  }),
  subject_ids: z.array(z.string().uuid()).min(1, 'Please select at least one subject'),
  skip_parent_details: z.boolean().default(false),
  parent_first_name: z.string().max(100).optional(),
  parent_last_name: z.string().max(100).optional(),
  parent_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  parent_phone: z.string().optional(),
}).superRefine((data, ctx) => {
  // If not skipping parent details, require all parent fields
  if (!data.skip_parent_details) {
    if (!data.parent_first_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent first name is required',
        path: ['parent_first_name'],
      });
    }
    if (!data.parent_last_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent last name is required',
        path: ['parent_last_name'],
      });
    }
    if (!data.parent_email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent email is required',
        path: ['parent_email'],
      });
    }
    if (!data.parent_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent phone number is required',
        path: ['parent_phone'],
      });
    }
  }
});

export type TrialContactFormValues = z.infer<typeof trialContactSchema>;

interface TrialContactFormProps {
  onSubmit: (data: TrialContactFormValues) => void;
  defaultValues?: Partial<TrialContactFormValues>;
  isLoading?: boolean;
  onFormReady?: (form: UseFormReturn<TrialContactFormValues>) => void;
  onValidityChange?: (isValid: boolean) => void;
  onSelectedSubjectsChange?: (subjects: Tables<'subjects'>[]) => void;
}

export function TrialContactForm({ onSubmit, defaultValues, isLoading: _isLoading = false, onFormReady, onValidityChange, onSelectedSubjectsChange }: TrialContactFormProps) {
  const form = useForm({
    resolver: zodResolver(trialContactSchema),
    mode: 'onChange', // Validate on change for real-time feedback
    defaultValues: {
      student_first_name: '',
      student_last_name: '',
      student_email: '',
      student_phone: '',
      curriculum: undefined as 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | undefined,
      year_level: undefined,
      subject_ids: [],
      skip_parent_details: false,
      parent_first_name: '',
      parent_last_name: '',
      parent_email: '',
      parent_phone: '',
      ...defaultValues,
    },
  });

  const skipParentDetails = form.watch('skip_parent_details');
  const curriculum = form.watch('curriculum');
  const yearLevel = form.watch('year_level');
  const watchedSubjectIds = form.watch('subject_ids');
  const selectedSubjectIds = useMemo(() => watchedSubjectIds || [], [watchedSubjectIds]);

  // Helper functions to determine valid options
  const getYearLevelNum = (yearLevel: string | undefined): number | null => {
    if (!yearLevel) return null;
    if (yearLevel === 'Reception') return 0;
    return parseInt(yearLevel, 10);
  };

  const getValidCurriculums = useCallback((yearLevel: string | undefined): Array<'SACE' | 'IB' | 'PRESACE' | 'PRIMARY'> => {
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
  }, []);

  const getValidYearLevels = useCallback((curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | undefined): string[] => {
    if (!curriculum) return ['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
    
    if (curriculum === 'SACE' || curriculum === 'IB') {
      return ['11', '12', '13'];
    } else if (curriculum === 'PRESACE') {
      return ['7', '8', '9', '10'];
    } else if (curriculum === 'PRIMARY') {
      return ['Reception', '1', '2', '3', '4', '5', '6'];
    }
    return ['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
  }, []);

  const validCurriculums = useMemo(() => getValidCurriculums(yearLevel), [getValidCurriculums, yearLevel]);
  const validYearLevels = useMemo(() => getValidYearLevels(curriculum), [getValidYearLevels, curriculum]);

  // Auto-select curriculum when year level changes
  useEffect(() => {
    if (!yearLevel) return;
    
    const yearLevelNum = getYearLevelNum(yearLevel);
    if (yearLevelNum === null) return;

    const currentCurriculum = form.getValues('curriculum');
    
    // If current curriculum is not valid for the selected year level, auto-select
    if (yearLevelNum >= 11 && yearLevelNum <= 13) {
      if (currentCurriculum !== 'SACE' && currentCurriculum !== 'IB') {
        // Auto-select SACE as default
        form.setValue('curriculum', 'SACE', { shouldValidate: true });
      }
    } else if (yearLevelNum >= 7 && yearLevelNum <= 10) {
      if (currentCurriculum !== 'PRESACE') {
        form.setValue('curriculum', 'PRESACE', { shouldValidate: true });
      }
    } else if (yearLevelNum >= 0 && yearLevelNum <= 6) {
      if (currentCurriculum !== 'PRIMARY') {
        form.setValue('curriculum', 'PRIMARY', { shouldValidate: true });
      }
    }
  }, [yearLevel, form]);

  // Auto-select year level when curriculum changes
  useEffect(() => {
    if (!curriculum) return;
    
    const currentYearLevel = form.getValues('year_level');
    const validYearLevelsForCurriculum = getValidYearLevels(curriculum);
    
    // If current year level is not valid for the selected curriculum, auto-select first valid option
    if (currentYearLevel && !validYearLevelsForCurriculum.includes(currentYearLevel)) {
      form.setValue('year_level', validYearLevelsForCurriculum[0] as TrialContactFormValues['year_level'], { shouldValidate: true });
    }
  }, [curriculum, form, getValidYearLevels]);

  // Subject search state
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(subjectSearchQuery, 300);
  // Cache of selected subject objects (to show subjects that don't match current filters)
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());

  // Fetch subjects filtered by curriculum/year level (React Query)
  const { data: subjectsFilteredData, isLoading: isLoadingFiltered } = useSubjectsSearch({
    curriculum: curriculum ?? null,
    yearLevel: yearLevel ?? null,
  });
  const allSubjects = useMemo(() => subjectsFilteredData?.subjects ?? [], [subjectsFilteredData?.subjects]);

  // Search by term when user types (ignores curriculum/year level)
  const { data: subjectsSearchData, isFetching: isSearchingByTerm } = useSubjectSearchWithTerm({
    searchTerm: debouncedSearchQuery,
    enabled: debouncedSearchQuery.trim().length > 0,
  });
  const subjectSearchResults = useMemo(
    () =>
      debouncedSearchQuery.trim().length > 0 ? (subjectsSearchData?.subjects ?? []) : allSubjects,
    [debouncedSearchQuery, subjectsSearchData?.subjects, allSubjects]
  );

  const isSearchingSubjects = isLoadingFiltered || (isSearchingByTerm && debouncedSearchQuery.trim().length > 0);

  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjectIds);
    return subjectSearchResults.filter((s) => !selectedIds.has(s.id));
  }, [subjectSearchResults, selectedSubjectIds]);

  const selectedSubjects = useMemo(() => {
    if (!selectedSubjectIds || selectedSubjectIds.length === 0) return [];
    // Use cached subjects first, then try to find from current lists
    const subjects: Tables<'subjects'>[] = [];
    const allAvailableSubjects = [...allSubjects, ...subjectSearchResults];
    const uniqueSubjectsMap = new Map(allAvailableSubjects.map(s => [s.id, s]));
    
    // Merge cache with current lists
    const mergedMap = new Map([...selectedSubjectsCache, ...uniqueSubjectsMap]);
    
    selectedSubjectIds.forEach(id => {
      const subject = mergedMap.get(id);
      if (subject) {
        subjects.push(subject);
      }
    });
    
    return subjects;
  }, [selectedSubjectIds, allSubjects, subjectSearchResults, selectedSubjectsCache]);

  const handleSelectSubject = (subject: Tables<'subjects'>) => {
    const currentIds = form.getValues('subject_ids') || [];
    form.setValue('subject_ids', [...currentIds, subject.id]);
    // Cache the subject object so we can display it even if filters change
    setSelectedSubjectsCache(prev => new Map(prev).set(subject.id, subject));
    setSubjectSearchQuery('');
  };

  const handleRemoveSubject = (subjectId: string) => {
    const currentIds = form.getValues('subject_ids') || [];
    form.setValue('subject_ids', currentIds.filter(id => id !== subjectId));
    // Remove from cache
    setSelectedSubjectsCache(prev => {
      const newMap = new Map(prev);
      newMap.delete(subjectId);
      return newMap;
    });
  };

  // Expose form to parent for programmatic submission (only when form reference changes to avoid infinite loops)
  const lastFormRef = useRef<UseFormReturn<TrialContactFormValues> | null>(null);
  useEffect(() => {
    if (onFormReady && form !== lastFormRef.current) {
      lastFormRef.current = form as unknown as UseFormReturn<TrialContactFormValues>;
      onFormReady(form as unknown as UseFormReturn<TrialContactFormValues>);
    }
  }, [form, onFormReady]);

  // Watch form validity and notify parent only when value changes
  const isValid = form.formState.isValid;
  const lastValidRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (onValidityChange && isValid !== lastValidRef.current) {
      lastValidRef.current = isValid;
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  // Notify parent of selected subjects changes only when selection actually changes
  const lastSubjectIdsRef = useRef<string | null>(null);
  const subjectIdsKey = selectedSubjectIds.slice().sort().join(',');
  useEffect(() => {
    if (onSelectedSubjectsChange && subjectIdsKey !== lastSubjectIdsRef.current) {
      lastSubjectIdsRef.current = subjectIdsKey;
      onSelectedSubjectsChange(selectedSubjects);
    }
  }, [subjectIdsKey, selectedSubjects, onSelectedSubjectsChange]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Student Details */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Student Details</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="student_first_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="student_last_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name *</FormLabel>
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
              name="student_email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="student_phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone *</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value}
                      onChange={field.onChange}
                      error={form.formState.errors.student_phone?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="year_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year Level *</FormLabel>
                  <FormControl>
                    <SearchableSelect<string>
                      items={validYearLevels}
                      value={field.value && validYearLevels.includes(field.value) ? field.value : null}
                      onValueChange={(item) => {
                        if (item === null) {
                          const currentCurriculum = form.getValues('curriculum');
                          form.setValue('year_level', undefined as unknown as TrialContactFormValues['year_level'], { shouldValidate: true });
                          if (currentCurriculum && getValidYearLevels(currentCurriculum).length > 0) {
                            form.setValue('curriculum', undefined as unknown as TrialContactFormValues['curriculum'], { shouldValidate: true });
                          }
                        } else {
                          field.onChange(item);
                        }
                      }}
                      getItemLabel={(year) => (year === 'Reception' ? 'Reception' : `Year ${year}`)}
                      getItemId={(year) => year}
                      placeholder="Select year level"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="curriculum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curriculum *</FormLabel>
                  <FormControl>
                    <SearchableSelect<'SACE' | 'IB' | 'PRESACE' | 'PRIMARY'>
                      items={validCurriculums}
                      value={field.value ?? null}
                      onValueChange={(item) => {
                        if (item === null) {
                          const currentYearLevel = form.getValues('year_level');
                          form.setValue('curriculum', undefined as unknown as TrialContactFormValues['curriculum'], { shouldValidate: true });
                          if (currentYearLevel) {
                            const validCurriculumsForYear = getValidCurriculums(currentYearLevel);
                            if (validCurriculumsForYear.length > 0 && validCurriculumsForYear.length < 4) {
                              form.setValue('year_level', undefined as unknown as TrialContactFormValues['year_level'], { shouldValidate: true });
                            }
                          }
                        } else {
                          field.onChange(item);
                        }
                      }}
                      getItemLabel={(curr) => curr}
                      getItemId={(curr) => curr}
                      placeholder="Select curriculum"
                      allowClear
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Subject Selector */}
          <FormField
            control={form.control}
            name="subject_ids"
            render={() => (
              <FormItem>
                <FormLabel>Subjects *</FormLabel>
                <div className="space-y-2">
                {selectedSubjects.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedSubjects.map((subject) => {
                      const { style, textColorClass } = getSubjectColorStyle(subject);
                      const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';
                      return (
                        <Badge
                          key={subject.id}
                          className={cn(
                            defaultClass || `${textColorClass} cursor-pointer hover:opacity-80 flex items-center gap-1`,
                            !defaultClass && 'border-0'
                          )}
                          style={style.backgroundColor ? style : undefined}
                        >
                          {formatSubjectDisplay(subject)}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSubject(subject.id);
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <SearchableSelect<Tables<'subjects'>>
                  items={availableSubjects}
                  value={null}
                  onValueChange={(item) => item && handleSelectSubject(item)}
                  getItemLabel={formatSubjectDisplay}
                  getItemId={(s) => s.id}
                  placeholder="Add subject"
                  searchPlaceholder="Search subjects..."
                  emptyMessage={
                    subjectSearchQuery
                      ? 'No subjects match your search'
                      : 'No available subjects found'
                  }
                  loading={isSearchingSubjects}
                  onSearchChange={(query) => setSubjectSearchQuery(query)}
                  onOpenChange={(open) => !open && setSubjectSearchQuery('')}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span>Add Subject</span>
                    </Button>
                  }
                  contentWidth="400px"
                />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Parent Details */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Parent Details</h3>
            <FormField
              control={form.control}
              name="skip_parent_details"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="cursor-pointer text-sm font-normal">
                    Skip parent details
                  </FormLabel>
                </FormItem>
              )}
            />
          </div>

          {!skipParentDetails && (
            <>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parent_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="parent_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="parent_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parent_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <PhoneInput
                          value={field.value || ''}
                          onChange={field.onChange}
                          error={form.formState.errors.parent_phone?.message}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </div>

        {/* Submit button is handled by BookingFlow */}
      </form>
    </Form>
  );
}

