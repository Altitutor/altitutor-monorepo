'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Loader2, Plus, X } from 'lucide-react';
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

  const getValidCurriculums = (yearLevel: string | undefined): Array<'SACE' | 'IB' | 'PRESACE' | 'PRIMARY'> => {
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

  const getValidYearLevels = (curriculum: 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | undefined): string[] => {
    if (!curriculum) return ['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
    
    if (curriculum === 'SACE' || curriculum === 'IB') {
      return ['11', '12', '13'];
    } else if (curriculum === 'PRESACE') {
      return ['7', '8', '9', '10'];
    } else if (curriculum === 'PRIMARY') {
      return ['Reception', '1', '2', '3', '4', '5', '6'];
    }
    return ['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
  };

  const validCurriculums = useMemo(() => getValidCurriculums(yearLevel), [yearLevel]);
  const validYearLevels = useMemo(() => getValidYearLevels(curriculum), [curriculum]);

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
      form.setValue('year_level', validYearLevelsForCurriculum[0] as any, { shouldValidate: true });
    }
  }, [curriculum, form]);

  // Subject search state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [subjectSearchResults, setSubjectSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  // Cache of selected subject objects (to show subjects that don't match current filters)
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());

  // Fetch all subjects (always show subject selector)
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsSearchingSubjects(true);
      try {
        const params = new URLSearchParams({
          limit: '100',
        });
        
        // Optionally filter by curriculum and year level if provided
        if (curriculum) params.set('curriculums', curriculum);
        if (yearLevel) {
          let yearLevelNum = yearLevel === 'Reception' ? 0 : parseInt(yearLevel, 10);
          // If year 13 is selected, send 12 instead for subject search
          if (yearLevelNum === 13) {
            yearLevelNum = 12;
          }
          params.set('year_levels', yearLevelNum.toString());
        }
        
        const response = await fetch(`/api/subjects/search?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch subjects');
        
        const data = await response.json();
        setAllSubjects(data.subjects || []);
      } catch (error) {
        console.error('Error fetching subjects:', error);
        setAllSubjects([]);
      } finally {
        setIsSearchingSubjects(false);
      }
    };

    fetchSubjects();
  }, [curriculum, yearLevel]);

  // Debounced subject search
  useEffect(() => {
    if (!isSubjectPopoverOpen) {
      setSubjectSearchQuery('');
      setSubjectSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      if (subjectSearchQuery.trim().length === 0) {
        // No search term - use filtered subjects (respect curriculum/year level)
        setSubjectSearchResults(allSubjects);
        setIsSearchingSubjects(false);
      } else {
        // Search term present - search ALL subjects (ignore filters)
        setIsSearchingSubjects(true);
        try {
          const params = new URLSearchParams({
            search: subjectSearchQuery.trim(),
            limit: '100',
          });
          // DO NOT add curriculum/year_level filters when searching
          
          const response = await fetch(`/api/subjects/search?${params.toString()}`);
          if (!response.ok) throw new Error('Failed to search subjects');
          
          const data = await response.json();
          setSubjectSearchResults(data.subjects || []);
        } catch (error) {
          console.error('Error searching subjects:', error);
          setSubjectSearchResults([]);
        } finally {
          setIsSearchingSubjects(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [subjectSearchQuery, isSubjectPopoverOpen, allSubjects]);

  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjectIds);
    const subjectsToShow = subjectSearchQuery.trim().length > 0 ? subjectSearchResults : allSubjects;
    return subjectsToShow.filter(s => !selectedIds.has(s.id));
  }, [subjectSearchResults, allSubjects, selectedSubjectIds, subjectSearchQuery]);

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
    setIsSubjectPopoverOpen(false);
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

  // Expose form to parent for programmatic submission
  useEffect(() => {
    if (onFormReady) {
      // Type assertion needed due to react-hook-form's type inference with default values
      onFormReady(form as unknown as UseFormReturn<TrialContactFormValues>);
    }
  }, [form, onFormReady]);

  // Watch form validity and notify parent
  const isValid = form.formState.isValid;
  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(isValid);
    }
  }, [isValid, onValidityChange]);

  // Notify parent of selected subjects changes
  useEffect(() => {
    if (onSelectedSubjectsChange) {
      onSelectedSubjectsChange(selectedSubjects);
    }
  }, [selectedSubjects, onSelectedSubjectsChange]);

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
                  <div className="relative">
                    <Select 
                      value={field.value || ""} 
                      onValueChange={(value) => {
                        field.onChange(value === "" ? undefined : value);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className={cn(field.value && "pr-10 [&_svg]:hidden")}>
                          <SelectValue placeholder="Select year level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {validYearLevels.map((year) => (
                          <SelectItem key={year} value={year}>
                            {year === 'Reception' ? 'Reception' : `Year ${year}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentCurriculum = form.getValues('curriculum');
                          form.setValue('year_level', undefined as any, { shouldValidate: true });
                          // If curriculum requires a year level, clear it too
                          if (currentCurriculum && getValidYearLevels(currentCurriculum).length > 0) {
                            form.setValue('curriculum', undefined as any, { shouldValidate: true });
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
              name="curriculum"
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
                          const currentYearLevel = form.getValues('year_level');
                          form.setValue('curriculum', undefined as any, { shouldValidate: true });
                          // If year level requires a curriculum, clear it too
                          if (currentYearLevel) {
                            const validCurriculumsForYear = getValidCurriculums(currentYearLevel);
                            if (validCurriculumsForYear.length > 0 && validCurriculumsForYear.length < 4) {
                              form.setValue('year_level', undefined as any, { shouldValidate: true });
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
                <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      <span>Add Subject</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[400px]">
                    <div className="p-3">
                      <Input
                        placeholder="Search subjects..."
                        value={subjectSearchQuery}
                        onChange={(e) => setSubjectSearchQuery(e.target.value)}
                        className="mb-3"
                      />
                      <ScrollArea className="h-[300px]">
                        <div className="space-y-1 pr-4">
                          {isSearchingSubjects ? (
                            <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Searching...
                            </div>
                          ) : availableSubjects.length === 0 ? (
                            <div className="p-3 text-center text-sm text-muted-foreground">
                              {subjectSearchQuery
                                ? 'No subjects match your search'
                                : 'No available subjects found'}
                            </div>
                          ) : (
                            availableSubjects.map((subject) => (
                              <Button
                                key={subject.id}
                                type="button"
                                variant="ghost"
                                className="w-full justify-start h-auto p-3"
                                onClick={() => handleSelectSubject(subject)}
                              >
                                <div className="flex flex-col items-start w-full">
                                  <div className="font-medium">
                                    {formatSubjectDisplay(subject)}
                                  </div>
                                </div>
                              </Button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </PopoverContent>
                </Popover>
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

