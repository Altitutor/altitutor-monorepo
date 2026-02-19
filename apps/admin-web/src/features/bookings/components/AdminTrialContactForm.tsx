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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { PhoneInput } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Loader2, Plus, X } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { formatSubjectDisplay, cn, getSubjectColorStyle } from '@/shared/utils';
import { useSubjectsList } from '@/features/subjects/hooks/useSubjectsQuery';
import { useDebounce } from '@/shared/hooks/useDebounce';

const adminTrialContactSchema = z.object({
  student_first_name: z.string().min(1, 'First name is required').max(100),
  student_last_name: z.string().min(1, 'Last name is required').max(100),
  student_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  student_phone: z.string().min(1, 'Phone number is required'),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY']).optional(),
  year_level: z.enum(['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']).optional(),
  subject_ids: z.array(z.string().uuid()).optional(),
  skip_parent_details: z.boolean().default(false),
  parent_first_name: z.string().max(100).optional(),
  parent_last_name: z.string().max(100).optional(),
  parent_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  parent_phone: z.string().optional(),
});

export type AdminTrialContactFormValues = z.infer<typeof adminTrialContactSchema>;

interface AdminTrialContactFormProps {
  onSubmit: (data: AdminTrialContactFormValues) => void;
  defaultValues?: Partial<AdminTrialContactFormValues>;
  isLoading?: boolean;
  onFormReady?: (form: UseFormReturn<AdminTrialContactFormValues>) => void;
  onValidityChange?: (isValid: boolean) => void;
  onSelectedSubjectsChange?: (subjects: Tables<'subjects'>[]) => void;
}

export function AdminTrialContactForm({
  onSubmit,
  defaultValues,
  isLoading: _isLoading = false,
  onFormReady,
  onValidityChange,
  onSelectedSubjectsChange,
}: AdminTrialContactFormProps) {
  const form = useForm({
    resolver: zodResolver(adminTrialContactSchema),
    mode: 'onChange',
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

  // Subject search state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const debouncedSubjectSearch = useDebounce(subjectSearchQuery, 300);
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());

  const curriculumFilter = curriculum ? [curriculum] : undefined;
  const yearLevelFilter = yearLevel
    ? [yearLevel === 'Reception' ? 0 : parseInt(yearLevel, 10)]
    : undefined;

  const { data: allSubjectsData, isLoading: isLoadingFiltered } = useSubjectsList({
    curriculums: curriculumFilter,
    yearLevels: yearLevelFilter,
    limit: 100,
    offset: 0,
  });
  const allSubjects = allSubjectsData?.subjects ?? [];

  const { data: searchResultsData, isLoading: isSearchingSubjects } = useSubjectsList({
    search: debouncedSubjectSearch.trim() || undefined,
    limit: 100,
    offset: 0,
  });
  const subjectSearchResults =
    debouncedSubjectSearch.trim().length > 0 ? (searchResultsData?.subjects ?? []) : allSubjects;
  const isSubjectListLoading =
    subjectSearchQuery.trim().length > 0 ? isSearchingSubjects : isLoadingFiltered;

  useEffect(() => {
    if (!isSubjectPopoverOpen) {
      setSubjectSearchQuery('');
    }
  }, [isSubjectPopoverOpen]);

  const availableSubjects = useMemo(() => {
    const selectedIds = new Set(selectedSubjectIds);
    const subjectsToShow = subjectSearchQuery.trim().length > 0 ? subjectSearchResults : allSubjects;
    return subjectsToShow.filter((s) => !selectedIds.has(s.id));
  }, [subjectSearchResults, allSubjects, selectedSubjectIds, subjectSearchQuery]);

  const selectedSubjects = useMemo(() => {
    if (!selectedSubjectIds || selectedSubjectIds.length === 0) return [];
    const subjects: Tables<'subjects'>[] = [];
    const allAvailableSubjects = [...allSubjects, ...subjectSearchResults];
    const uniqueSubjectsMap = new Map(allAvailableSubjects.map((s) => [s.id, s]));

    const mergedMap = new Map([...selectedSubjectsCache, ...uniqueSubjectsMap]);

    selectedSubjectIds.forEach((id) => {
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
    setSelectedSubjectsCache((prev) => new Map(prev).set(subject.id, subject));
    setIsSubjectPopoverOpen(false);
    setSubjectSearchQuery('');
  };

  const handleRemoveSubject = (subjectId: string) => {
    const currentIds = form.getValues('subject_ids') || [];
    form.setValue('subject_ids', currentIds.filter((id) => id !== subjectId));
    setSelectedSubjectsCache((prev) => {
      const newMap = new Map(prev);
      newMap.delete(subjectId);
      return newMap;
    });
  };

  // Expose form to parent
  useEffect(() => {
    if (onFormReady) {
      onFormReady(form as unknown as UseFormReturn<AdminTrialContactFormValues>);
    }
  }, [form, onFormReady]);

  // Watch form validity - only check required fields (first_name, last_name, phone)
  const watchedFirstName = form.watch('student_first_name');
  const watchedLastName = form.watch('student_last_name');
  const watchedPhone = form.watch('student_phone');
  const errors = form.formState.errors;
  const isValidRequiredFields = useMemo(() => {
    const firstName = watchedFirstName?.trim() || '';
    const lastName = watchedLastName?.trim() || '';
    const phone = watchedPhone?.trim() || '';
    
    return (
      firstName.length > 0 &&
      !errors.student_first_name &&
      lastName.length > 0 &&
      !errors.student_last_name &&
      phone.length > 0 &&
      !errors.student_phone
    );
  }, [watchedFirstName, watchedLastName, watchedPhone, errors]);
  
  useEffect(() => {
    if (onValidityChange) {
      onValidityChange(isValidRequiredFields);
    }
  }, [isValidRequiredFields, onValidityChange]);

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
                  <FormLabel>Email</FormLabel>
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
                    <PhoneInput value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="curriculum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curriculum</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select curriculum" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SACE">SACE</SelectItem>
                      <SelectItem value="IB">IB</SelectItem>
                      <SelectItem value="PRESACE">Pre-SACE</SelectItem>
                      <SelectItem value="PRIMARY">Primary</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year_level"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Year Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select year level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Reception">Reception</SelectItem>
                      {Array.from({ length: 13 }, (_, i) => i + 1).map((year) => (
                        <SelectItem key={year} value={String(year)}>
                          Year {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Subject Selection */}
          <FormField
            control={form.control}
            name="subject_ids"
            render={() => (
              <FormItem>
                <FormLabel>Subjects</FormLabel>
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
                              defaultClass || `${textColorClass} border-0`,
                              !defaultClass && 'border-0'
                            )}
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
                  )}
                  <Popover open={isSubjectPopoverOpen} onOpenChange={setIsSubjectPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-muted"
                      >
                        <Plus className="h-4 w-4" />
                        Add Subject
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-3">
                        <Input
                          placeholder="Search subjects..."
                          value={subjectSearchQuery}
                          onChange={(e) => setSubjectSearchQuery(e.target.value)}
                          className="mb-3"
                        />
                        <ScrollArea className="h-[300px]">
                          <div className="space-y-1 pr-4">
                            {isSubjectListLoading ? (
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
                                <button
                                  key={subject.id}
                                  type="button"
                                  onClick={() => handleSelectSubject(subject)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md"
                                >
                                  {formatSubjectDisplay(subject)}
                                </button>
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
            <h3 className="text-lg font-semibold">Parent/Guardian Details</h3>
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
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
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
                      <FormLabel>Last Name</FormLabel>
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
                  name="parent_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <PhoneInput value={field.value || ''} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </div>
      </form>
    </Form>
  );
}
