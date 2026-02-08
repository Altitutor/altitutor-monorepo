'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BreadcrumbItem } from '@/shared/components/Breadcrumb';
import { studentsApi } from '@/features/students/api';
import { staffApi } from '@/features/staff/api';
import { classesApi } from '@/features/classes/api';
import { sessionsApi } from '@/features/sessions/api';
import { subjectsApi } from '@/features/subjects/api';
import { topicsApi } from '@/features/topics/api';
import { useNote } from '@/features/notes/api/queries';
import { formatClassShortName, formatSubjectShortName } from '@/shared/utils';

// Map of path segments to display labels
const pathLabelMap: Record<string, string> = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  students: 'Students',
  staff: 'Staff',
  classes: 'Classes',
  sessions: 'Sessions',
  messages: 'Messages',
  invoices: 'Invoices',
  reports: 'Reports',
  subjects: 'Subjects',
  topics: 'Topics',
  notes: 'Notes',
  settings: 'Settings',
  billing: 'Billing',
  payments: 'Payments',
  pricing: 'Pricing',
  reconciliation: 'Reconciliation',
  'subject-overrides': 'Subject Overrides',
  bulk: 'Bulk',
  templates: 'Templates',
  'opening-hours': 'Opening Hours',
  blockouts: 'Blockouts',
  booking: 'Booking',
  'class-planner': 'Class Planner',
  'my-account': 'My Account',
};

/**
 * Capitalizes the first letter of a string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a path segment to a display label
 */
function getLabelForSegment(segment: string): string {
  // Check if we have a specific label mapping
  if (pathLabelMap[segment]) {
    return pathLabelMap[segment];
  }
  
  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map(word => capitalize(word))
    .join(' ');
}

/**
 * Check if a segment is a UUID
 */
function isUUID(segment: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
}

/**
 * Hook to generate breadcrumbs from the current pathname
 */
export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();

  // Parse path segments
  const segments = useMemo(() => {
    return pathname.split('/').filter(Boolean);
  }, [pathname]);

  // Determine which entity IDs we need to fetch
  const entityIds = useMemo(() => {
    const ids: { type: 'student' | 'staff' | 'class' | 'session' | 'subject' | 'topic' | 'note'; id: string; index: number }[] = [];
    
    segments.forEach((segment, index) => {
      if (isUUID(segment)) {
        // Determine entity type based on previous segment
        const prevSegment = index > 0 ? segments[index - 1] : '';
        
        if (prevSegment === 'students') {
          ids.push({ type: 'student', id: segment, index });
        } else if (prevSegment === 'staff') {
          ids.push({ type: 'staff', id: segment, index });
        } else if (prevSegment === 'classes') {
          ids.push({ type: 'class', id: segment, index });
        } else if (prevSegment === 'sessions') {
          ids.push({ type: 'session', id: segment, index });
        } else if (prevSegment === 'subjects') {
          // Could be subject or topic (if next segment is 'topics')
          const nextSegment = index < segments.length - 1 ? segments[index + 1] : '';
          if (nextSegment === 'topics') {
            // This is a subject ID, topic comes after
            ids.push({ type: 'subject', id: segment, index });
          } else {
            ids.push({ type: 'subject', id: segment, index });
          }
        } else if (prevSegment === 'topics' || (index > 1 && segments[index - 2] === 'subjects' && segments[index - 1] === 'topics')) {
          ids.push({ type: 'topic', id: segment, index });
        } else if (prevSegment === 'notes') {
          ids.push({ type: 'note', id: segment, index });
        } else if (prevSegment === 'invoices') {
          // Invoices keep ID as-is
        }
      }
    });
    
    return ids;
  }, [segments]);

  // Fetch entity names
  const studentQueries = useQuery({
    queryKey: ['breadcrumb-student', entityIds.filter(e => e.type === 'student').map(e => e.id)],
    queryFn: async () => {
      const studentIds = entityIds.filter(e => e.type === 'student').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        studentIds.map(async (id) => {
          try {
            const student = await studentsApi.getStudent(id);
            if (student) {
              results[id] = `${student.first_name} ${student.last_name}`;
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'student'),
    staleTime: 1000 * 60 * 5,
  });

  const staffQueries = useQuery({
    queryKey: ['breadcrumb-staff', entityIds.filter(e => e.type === 'staff').map(e => e.id)],
    queryFn: async () => {
      const staffIds = entityIds.filter(e => e.type === 'staff').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        staffIds.map(async (id) => {
          try {
            const staff = await staffApi.getStaff(id);
            if (staff) {
              results[id] = `${staff.first_name} ${staff.last_name}`;
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'staff'),
    staleTime: 1000 * 60 * 5,
  });

  const classQueries = useQuery({
    queryKey: ['breadcrumb-class', entityIds.filter(e => e.type === 'class').map(e => e.id)],
    queryFn: async () => {
      const classIds = entityIds.filter(e => e.type === 'class').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        classIds.map(async (id) => {
          try {
            const classData = await classesApi.getClassWithDetails(id);
            if (classData.class && classData.subject) {
              results[id] = formatClassShortName(classData.class, classData.subject);
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'class'),
    staleTime: 1000 * 60 * 5,
  });

  const sessionQueries = useQuery({
    queryKey: ['breadcrumb-session', entityIds.filter(e => e.type === 'session').map(e => e.id)],
    queryFn: async () => {
      const sessionIds = entityIds.filter(e => e.type === 'session').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        sessionIds.map(async (id) => {
          try {
            const sessionData = await sessionsApi.getSessionWithTutorLog(id);
            if (sessionData.session?.class) {
              const classData = await classesApi.getClassWithDetails(sessionData.session.class.id);
              if (classData.class && classData.subject) {
                // Use formatClassShortName for session breadcrumb (same as class)
                results[id] = formatClassShortName(classData.class, classData.subject);
              }
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'session'),
    staleTime: 1000 * 60 * 5,
  });

  const subjectQueries = useQuery({
    queryKey: ['breadcrumb-subject', entityIds.filter(e => e.type === 'subject').map(e => e.id)],
    queryFn: async () => {
      const subjectIds = entityIds.filter(e => e.type === 'subject').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        subjectIds.map(async (id) => {
          try {
            const subject = await subjectsApi.getSubject(id);
            if (subject) {
              results[id] = formatSubjectShortName(subject);
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'subject'),
    staleTime: 1000 * 60 * 5,
  });

  const topicQueries = useQuery({
    queryKey: ['breadcrumb-topic', entityIds.filter(e => e.type === 'topic').map(e => e.id)],
    queryFn: async () => {
      const topicIds = entityIds.filter(e => e.type === 'topic').map(e => e.id);
      const results: Record<string, string> = {};
      await Promise.all(
        topicIds.map(async (id) => {
          try {
            const topic = await topicsApi.getTopic(id);
            if (topic) {
              const code = topic.code || '';
              results[id] = `${code} ${topic.name}`;
            }
          } catch {
            // Ignore errors
          }
        })
      );
      return results;
    },
    enabled: entityIds.some(e => e.type === 'topic'),
    staleTime: 1000 * 60 * 5,
  });

  // Get note ID if we're on a note page
  const noteId = useMemo(() => {
    const noteEntity = entityIds.find(e => e.type === 'note');
    return noteEntity?.id;
  }, [entityIds]);

  const noteQuery = useNote(noteId || '', !!noteId);

  return useMemo(() => {
    // If we're on the dashboard, just return Dashboard
    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      return [{ label: 'Dashboard', href: '/dashboard' }];
    }

    // Always start with Dashboard
    const items: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/dashboard' },
    ];

    // Build breadcrumb items from path segments
    let currentPath = '';
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      
      const isDynamicRoute = isUUID(segment);
      
      let label: string;
      if (isDynamicRoute) {
        // Try to get the entity name
        const entityId = entityIds.find(e => e.index === index);
        if (entityId) {
          let name: string | undefined;
          
          if (entityId.type === 'student') {
            name = studentQueries.data?.[entityId.id];
          } else if (entityId.type === 'staff') {
            name = staffQueries.data?.[entityId.id];
          } else if (entityId.type === 'class') {
            name = classQueries.data?.[entityId.id];
          } else if (entityId.type === 'session') {
            name = sessionQueries.data?.[entityId.id];
          } else if (entityId.type === 'subject') {
            name = subjectQueries.data?.[entityId.id];
          } else if (entityId.type === 'topic') {
            name = topicQueries.data?.[entityId.id];
          } else if (entityId.type === 'note') {
            name = noteQuery.data?.title;
          }
          
          if (name) {
            label = name;
          } else {
            // Show loading or fallback
            label = segment.substring(0, 8) + '...';
          }
        } else {
          // Invoice or other - keep ID truncated
          label = segment.substring(0, 8) + '...';
        }
      } else {
        label = getLabelForSegment(segment);
      }

      items.push({
        label,
        href: isDynamicRoute ? undefined : currentPath,
      });
    });

    return items;
  }, [segments, entityIds, studentQueries.data, staffQueries.data, classQueries.data, sessionQueries.data, subjectQueries.data, topicQueries.data, noteQuery.data]);
}
