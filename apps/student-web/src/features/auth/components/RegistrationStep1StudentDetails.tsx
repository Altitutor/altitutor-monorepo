'use client';

import { useState, useEffect, useMemo } from 'react';
import { UseFormReturn } from 'react-hook-form';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
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
  parents: any[];
  availability: any;
  password: string;
  confirmPassword: string;
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

  // Subject search state
  const [isSubjectPopoverOpen, setIsSubjectPopoverOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [subjectSearchResults, setSubjectSearchResults] = useState<Tables<'subjects'>[]>([]);
  const [isSearchingSubjects, setIsSearchingSubjects] = useState(false);
  const [allSubjects, setAllSubjects] = useState<Tables<'subjects'>[]>([]);
  const [selectedSubjectsCache, setSelectedSubjectsCache] = useState<Map<string, Tables<'subjects'>>>(new Map());

  // Initialize cache with initial subjects
  useEffect(() => {
    const cache = new Map<string, Tables<'subjects'>>();
    initialSubjects.forEach((s) => {
      cache.set(s.id, s as Tables<'subjects'>);
    });
    setSelectedSubjectsCache(cache);
  }, [initialSubjects]);

  // Fetch subjects based on curriculum and year level
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsSearchingSubjects(true);
      try {
        const params = new URLSearchParams({ limit: '100' });
        if (curriculum) params.set('curriculums', curriculum);
        if (yearLevel !== undefined) params.set('year_levels', yearLevel.toString());
        
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
        setSubjectSearchResults(allSubjects);
        setIsSearchingSubjects(false);
      } else {
        setIsSearchingSubjects(true);
        try {
          const params = new URLSearchParams({
            search: subjectSearchQuery.trim(),
            limit: '100',
          });
          
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
          name="student.last_name"
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
          name="student.email"
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
          name="student.phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone *</FormLabel>
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
          name="student.curriculum"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Curriculum</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select curriculum" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="SACE">SACE</SelectItem>
                  <SelectItem value="IB">IB</SelectItem>
                  <SelectItem value="PRESACE">PRESACE</SelectItem>
                  <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="student.year_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Year Level</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === 'Reception' ? 0 : parseInt(value, 10))}
                value={field.value === 0 ? 'Reception' : field.value?.toString()}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select year level" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Reception">Reception</SelectItem>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((year) => (
                    <SelectItem key={year} value={year.toString()}>
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

      {/* Subjects */}
      <div className="space-y-2">
        <Label>Subjects</Label>
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
    </div>
  );
}
