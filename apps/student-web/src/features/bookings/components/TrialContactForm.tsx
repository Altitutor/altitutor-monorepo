'use client';

import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useEffect, useMemo, useRef } from 'react';
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
import { Plus } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { studentBtnOutline, studentCardCn } from '@/shared/lib/student-visual';
import { formatSubjectDisplay, cn } from '@/shared/utils';
import {
  SENIOR_CURRICULUMS,
  TRIAL_YEAR_LEVELS,
  curriculumAfterYearLevelChange,
  formatSubjectWithYearContext,
  yearLevelNeedsCurriculumChoice,
  type TrialCurriculum,
  type TrialYearLevel,
} from '../lib/trial-contact-academic';

const trialContactSchema = z.object({
  student_first_name: z.string().min(1, 'First name is required').max(100),
  student_last_name: z.string().max(100).optional().or(z.literal('')),
  student_email: z.string().email('Invalid email address'),
  student_phone: z.string().optional().or(z.literal('')),
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
  const showCurriculum = yearLevelNeedsCurriculumChoice(yearLevel);
  const canShowSubjects = Boolean(yearLevel && curriculum);

  const applyYearLevelChange = (nextYearLevel: TrialYearLevel | null) => {
    const nextCurriculum = curriculumAfterYearLevelChange(
      nextYearLevel ?? undefined,
      form.getValues('curriculum'),
    );
    form.setValue(
      'year_level',
      (nextYearLevel ?? undefined) as TrialContactFormValues['year_level'],
      { shouldValidate: true, shouldDirty: true },
    );
    form.setValue(
      'curriculum',
      nextCurriculum as TrialContactFormValues['curriculum'],
      { shouldValidate: true, shouldDirty: true },
    );
  };

  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [otherYearPickerOpen, setOtherYearPickerOpen] = useState(false);
  const debouncedSearchQuery = useDebounce(subjectSearchQuery, 300);
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());
  const [otherYearSubjectIds, setOtherYearSubjectIds] = useState<Set<string>>(new Set());
  const previousAcademicKeyRef = useRef(`${defaultValues?.year_level ?? ''}:${defaultValues?.curriculum ?? ''}`);

  const { data: subjectsFilteredData, isLoading: isLoadingFiltered } = useSubjectsSearch({
    curriculum: curriculum ?? null,
    yearLevel: yearLevel ?? null,
    enabled: canShowSubjects,
  });
  const yearSubjects = useMemo(() => subjectsFilteredData?.subjects ?? [], [subjectsFilteredData?.subjects]);
  const yearSubjectIds = useMemo(() => new Set(yearSubjects.map((subject) => subject.id)), [yearSubjects]);

  const { data: subjectsSearchData, isFetching: isSearchingByTerm } = useSubjectSearchWithTerm({
    searchTerm: debouncedSearchQuery,
    enabled: otherYearPickerOpen,
    allowEmptySearch: true,
  });
  const otherYearSearchResults = useMemo(() => {
    const selectedIds = new Set(selectedSubjectIds);
    return (subjectsSearchData?.subjects ?? []).filter(
      (subject) => !yearSubjectIds.has(subject.id) && !selectedIds.has(subject.id),
    );
  }, [subjectsSearchData?.subjects, yearSubjectIds, selectedSubjectIds]);

  const selectedSubjects = useMemo(() => {
    if (selectedSubjectIds.length === 0) return [];
    const merged = new Map<string, Tables<'subjects'>>([
      ...selectedSubjectsCache,
      ...yearSubjects.map((subject) => [subject.id, subject] as const),
    ]);
    return selectedSubjectIds
      .map((id) => merged.get(id))
      .filter((subject): subject is Tables<'subjects'> => Boolean(subject));
  }, [selectedSubjectIds, selectedSubjectsCache, yearSubjects]);

  const extraYearSubjects = useMemo(
    () => selectedSubjects.filter((subject) => !yearSubjectIds.has(subject.id)),
    [selectedSubjects, yearSubjectIds],
  );

  const setSelectedIds = (nextIds: string[]) => {
    form.setValue('subject_ids', nextIds, { shouldValidate: true, shouldDirty: true });
  };

  const handleToggleYearSubject = (subject: Tables<'subjects'>, checked: boolean) => {
    const currentIds = form.getValues('subject_ids') || [];
    if (checked) {
      if (!currentIds.includes(subject.id)) {
        setSelectedIds([...currentIds, subject.id]);
      }
      setSelectedSubjectsCache((prev) => new Map(prev).set(subject.id, subject));
      return;
    }
    setSelectedIds(currentIds.filter((id) => id !== subject.id));
    setOtherYearSubjectIds((prev) => {
      if (!prev.has(subject.id)) return prev;
      const next = new Set(prev);
      next.delete(subject.id);
      return next;
    });
  };

  const handleSelectOtherYearSubject = (subject: Tables<'subjects'>) => {
    handleToggleYearSubject(subject, true);
    if (!yearSubjectIds.has(subject.id)) {
      setOtherYearSubjectIds((prev) => new Set(prev).add(subject.id));
    }
    setSubjectSearchQuery('');
    setOtherYearPickerOpen(false);
  };

  useEffect(() => {
    const academicKey = `${yearLevel ?? ''}:${curriculum ?? ''}`;
    if (previousAcademicKeyRef.current === academicKey) return;
    previousAcademicKeyRef.current = academicKey;
    const currentIds = form.getValues('subject_ids') || [];
    const nextIds = currentIds.filter((id) => otherYearSubjectIds.has(id));
    if (nextIds.length !== currentIds.length) {
      form.setValue('subject_ids', nextIds, { shouldValidate: true, shouldDirty: true });
    }
  }, [yearLevel, curriculum, form, otherYearSubjectIds]);

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
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value || ''}
                      onChange={field.onChange}
                      error={form.formState.errors.student_phone?.message}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="year_level"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Year Level *</FormLabel>
                <FormControl>
                  <SearchableSelect<TrialYearLevel>
                    items={[...TRIAL_YEAR_LEVELS]}
                    value={(field.value as TrialYearLevel | undefined) ?? null}
                    onValueChange={(item) => applyYearLevelChange(item)}
                    getItemLabel={(year) => (year === 'Reception' ? 'Reception' : `Year ${year}`)}
                    getItemId={(year) => year}
                    placeholder="Select year level"
                    allowClear
                    fullWidth
                    contentWidth="var(--radix-popover-trigger-width)"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showCurriculum && (
            <FormField
              control={form.control}
              name="curriculum"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Curriculum *</FormLabel>
                  <FormControl>
                    <SearchableSelect<TrialCurriculum>
                      items={[...SENIOR_CURRICULUMS]}
                      value={field.value === 'SACE' || field.value === 'IB' ? field.value : null}
                      onValueChange={(item) => {
                        field.onChange(item ?? undefined);
                      }}
                      getItemLabel={(curr) => curr}
                      getItemId={(curr) => curr}
                      placeholder="Select curriculum"
                      allowClear
                      fullWidth
                      contentWidth="var(--radix-popover-trigger-width)"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {canShowSubjects && (
            <FormField
              control={form.control}
              name="subject_ids"
              render={() => (
                <FormItem>
                  <FormLabel>Subjects *</FormLabel>
                  <div className="space-y-2">
                    {isLoadingFiltered ? (
                      <p className="text-sm text-muted-foreground">Loading subjects...</p>
                    ) : yearSubjects.length === 0 && extraYearSubjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No subjects found for this year level.</p>
                    ) : (
                      <>
                        {yearSubjects.map((subject) => (
                          <SubjectChoiceCard
                            key={subject.id}
                            label={formatSubjectDisplay(subject)}
                            checked={selectedSubjectIds.includes(subject.id)}
                            onCheckedChange={(checked) => handleToggleYearSubject(subject, checked)}
                          />
                        ))}
                        {extraYearSubjects.map((subject) => (
                          <SubjectChoiceCard
                            key={subject.id}
                            label={formatSubjectWithYearContext(subject)}
                            checked
                            onCheckedChange={(checked) => handleToggleYearSubject(subject, checked)}
                          />
                        ))}
                      </>
                    )}
                    <SearchableSelect<Tables<'subjects'>>
                      items={otherYearSearchResults}
                      value={null}
                      onValueChange={(item) => item && handleSelectOtherYearSubject(item)}
                      getItemLabel={formatSubjectWithYearContext}
                      getItemId={(s) => s.id}
                      placeholder="Select a subject from another year level"
                      searchPlaceholder="Search subjects..."
                      emptyMessage={
                        subjectSearchQuery.trim()
                          ? 'No subjects match your search'
                          : 'No subjects from other year levels found'
                      }
                      loading={isSearchingByTerm}
                      onSearchChange={(query) => setSubjectSearchQuery(query)}
                      open={otherYearPickerOpen}
                      onOpenChange={(open) => {
                        setOtherYearPickerOpen(open);
                        if (!open) setSubjectSearchQuery('');
                      }}
                      trigger={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(studentBtnOutline, 'flex items-center gap-2')}
                        >
                          <Plus className="h-4 w-4" />
                          <span>select a subject from another year level</span>
                        </Button>
                      }
                      contentWidth="400px"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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

function SubjectChoiceCard({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={cn(
        studentCardCn('flex cursor-pointer items-center gap-3 p-3'),
        checked && 'ring-2 ring-foreground/15',
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <span className="min-w-0 flex-1 text-sm font-medium">{label}</span>
    </label>
  );
}

