'use client';

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Search, Loader2, GraduationCap, Users, Calendar } from 'lucide-react';
import { Input, Badge, Button } from '@altitutor/ui';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useGlobalSearch, flattenGlobalSearchResults } from '@/shared/hooks/useGlobalSearch';
import { getSubjectColorStyle, cn } from '@/shared/utils';
import { ViewStudentModal } from '@/features/students/components';
import { ViewStaffModal } from '@/features/staff/components/modal';
import { ViewClassModal } from '@/features/classes/components';
import type { ClassSummary, StaffSummary, StudentSummary } from '@/shared/api/search';

export function GlobalSearch() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useGlobalSearch({
    search: debouncedSearch,
    limit: 10,
  });

  const allResults = flattenGlobalSearchResults(data);

  const showPanel = isOpen;
  const searchTooShort = debouncedSearch.trim().length < 2;

  useEffect(() => {
    if (!showPanel) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPanel]);

  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage || searchTooShort) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, searchTooShort]);

  const handleResultClick = (result: typeof allResults[0]) => {
    setIsOpen(false);
    setSearchQuery('');

    if (result.type === 'student') {
      setSelectedStudentId(result.id);
      setIsStudentModalOpen(true);
    } else if (result.type === 'staff') {
      setSelectedStaffId(result.id);
      setIsStaffModalOpen(true);
    } else if (result.type === 'class') {
      setSelectedClassId(result.id);
      setIsClassModalOpen(true);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'student':
        return (
          <Badge variant="outline" className="text-xs">
            <GraduationCap className="h-3 w-3 mr-1" />
            Student
          </Badge>
        );
      case 'staff':
        return (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            Staff
          </Badge>
        );
      case 'class':
        return (
          <Badge variant="outline" className="text-xs">
            <Calendar className="h-3 w-3 mr-1" />
            Class
          </Badge>
        );
      default:
        return null;
    }
  };

  const normalizedQuery = searchQuery.trim();
  const highlightTokens = useMemo(
    () => normalizedQuery.toLowerCase().split(/\s+/).filter(Boolean),
    [normalizedQuery]
  );
  const highlightRegex = useMemo(() => {
    if (!highlightTokens.length) return null;
    const escapedTokens = highlightTokens.map((token) =>
      token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    return new RegExp(`(${escapedTokens.join('|')})`, 'gi');
  }, [highlightTokens]);

  const highlightText = useCallback(
    (value: string | null | undefined) => {
      if (!value) return null;
      if (!highlightRegex) return value;
      const parts = value.split(highlightRegex);
      return parts.map((part, index) => {
        if (!part) return null;
        const isMatch = index % 2 === 1;
        return isMatch ? (
          <span key={`${part}-${index}`} className="text-brand-lightBlue font-semibold">
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      });
    },
    [highlightRegex]
  );

  const buildClassLabels = useCallback((classData: ClassSummary) => {
    const shortName = classData.short_name?.trim() ?? classData.level ?? 'Class';
    const fullName = classData.long_name?.trim() ?? classData.level ?? 'Class';
    return { shortName, fullName };
  }, []);

  const handleClassChipClick = useCallback(
    (event: ReactMouseEvent, classId?: string | null) => {
      event.stopPropagation();
      if (!classId) return;
      setSelectedClassId(classId);
      setIsClassModalOpen(true);
    },
    []
  );

  const handleStudentChipClick = useCallback(
    (event: ReactMouseEvent, studentId?: string | null) => {
      event.stopPropagation();
      if (!studentId) return;
      setSelectedStudentId(studentId);
      setIsStudentModalOpen(true);
    },
    []
  );

  const handleStaffChipClick = useCallback(
    (event: ReactMouseEvent, staffId?: string | null) => {
      event.stopPropagation();
      if (!staffId) return;
      setSelectedStaffId(staffId);
      setIsStaffModalOpen(true);
    },
    []
  );

  const renderClassPills = (classes?: ClassSummary[] | null) => {
    if (!classes?.length) return null;
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {classes.map((cls) => {
          if (!cls) return null;
          const { shortName } = buildClassLabels(cls);
          const subject = cls.subject;
          const { style, textColorClass } = getSubjectColorStyle(subject as Parameters<typeof getSubjectColorStyle>[0]);
          const hasColor = Boolean(style.backgroundColor);

          return (
            <button
              key={cls.id}
              type="button"
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lightBlue/40',
                hasColor ? textColorClass : 'text-muted-foreground',
                hasColor ? '' : 'bg-muted'
              )}
              style={hasColor ? style : undefined}
              onClick={(event) => handleClassChipClick(event, cls.id)}
            >
              {highlightText(shortName)}
            </button>
          );
        })}
      </div>
    );
  };

  const renderPeoplePills = (
    people: (StudentSummary | StaffSummary)[] | undefined,
    variant: 'staff' | 'student'
  ) => {
    if (!people?.length) return null;
    const baseClass =
      variant === 'staff'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
        : 'bg-muted text-muted-foreground';

    const clickHandler = variant === 'staff' ? handleStaffChipClick : handleStudentChipClick;

    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {people.map((person) => {
          if (!person) return null;
          const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
          return (
            <button
              key={person.id}
              type="button"
              className={cn(
                'rounded px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lightBlue/40',
                baseClass
              )}
              onClick={(event) => clickHandler(event, person.id)}
            >
              {highlightText(fullName)}
            </button>
          );
        })}
      </div>
    );
  };

  const renderResult = (result: typeof allResults[0]) => {
    if (result.type === 'student') {
      const student = result.data;
      const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
      return (
        <div className="flex flex-col">
          <div className="font-medium">{highlightText(fullName)}</div>
          {student.school && (
            <div className="text-xs text-muted-foreground">{highlightText(student.school)}</div>
          )}
          {renderClassPills(student.classes)}
        </div>
      );
    }

    if (result.type === 'staff') {
      const staff = result.data;
      const fullName = [staff.first_name, staff.last_name].filter(Boolean).join(' ').trim();
      return (
        <div className="flex flex-col">
          <div className="font-medium">{highlightText(fullName)}</div>
          {staff.role && (
            <div className="text-xs text-muted-foreground">{highlightText(staff.role)}</div>
          )}
          {renderClassPills(staff.classes)}
        </div>
      );
    }

    if (result.type === 'class') {
      const classData = result.data;
      const { shortName, fullName } = buildClassLabels(classData);

      return (
        <div className="flex flex-col">
          <div className="font-medium">{highlightText(shortName)}</div>
          <div className="text-xs text-muted-foreground">{highlightText(fullName)}</div>
          {renderPeoplePills(classData.staff, 'staff')}
          {renderPeoplePills(classData.students, 'student')}
        </div>
      );
    }

    return null;
  };

  const helperText = useMemo(() => {
    if (searchTooShort) {
      return 'Type at least 2 characters to search';
    }
    if (isLoading && debouncedSearch.trim().length >= 2) {
      return 'Searching...';
    }
    if (!isLoading && allResults.length === 0) {
      return 'No results found';
    }
    return null;
  }, [searchTooShort, isLoading, debouncedSearch, allResults.length]);

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <>
      <div className="relative w-full max-w-xl" ref={containerRef}>
        <span className="sr-only">Global search</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search students, staff, or classes"
          className="pl-10"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
        />
        {showPanel && (
          <div className="absolute left-0 right-0 mt-2 rounded-lg border bg-popover text-popover-foreground shadow-xl z-50">
            <div className="max-h-[420px] overflow-y-auto overscroll-contain p-2">
              {helperText ? (
                <div className="p-4 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                  {helperText === 'Searching...' && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{helperText}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {allResults.map((result) => (
                    <Button
                      key={`${result.type}-${result.id}`}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3 text-left transition-colors hover:bg-brand-lightBlue/10 focus-visible:bg-brand-lightBlue/10 focus-visible:ring-2 focus-visible:ring-brand-lightBlue/40"
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="flex items-start gap-3 w-full">
                        <div className="mt-0.5">{getTypeBadge(result.type)}</div>
                        <div className="flex-1 text-left">{renderResult(result)}</div>
                      </div>
                    </Button>
                  ))}
                  {hasNextPage && (
                    <div
                      ref={sentinelRef}
                      className="h-10 flex items-center justify-center text-sm text-muted-foreground"
                    >
                      {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedStudentId && (
        <ViewStudentModal
          isOpen={isStudentModalOpen}
          onClose={() => {
            setIsStudentModalOpen(false);
            setSelectedStudentId(null);
          }}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}

      {selectedStaffId && (
        <ViewStaffModal
          isOpen={isStaffModalOpen}
          onClose={() => {
            setIsStaffModalOpen(false);
            setSelectedStaffId(null);
          }}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}

      {selectedClassId && (
        <ViewClassModal
          isOpen={isClassModalOpen}
          onClose={() => {
            setIsClassModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={() => {}}
        />
      )}
    </>
  );
}

