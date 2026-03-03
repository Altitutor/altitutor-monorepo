/**
 * Tests for filtering and sorting utilities
 */

import {
  filterAndSortCommands,
  filterAndSortPages,
  filterItemsByType,
  groupItemsByType,
} from '../filtering';
import type { CommandPaletteCommand, CommandPalettePage } from '../../config/commandPalette.config';
import type { Tables } from '@altitutor/shared';
import { Calendar, FileText, Home } from 'lucide-react';

// Mock match scoring
jest.mock('../matchScoring', () => ({
  calculateMatchScore: jest.fn((item: { type: 'command'; item: { title: string } } | { type: 'page'; item: { title: string } } | { type: 'entity'; result: unknown }, query: string) => {
    // Simple mock: return score based on title match (MatchScoringItem structure)
    const title = item.type === 'command' || item.type === 'page' ? item.item.title : 'Test';
    const titleLower = title.toLowerCase();
    const queryLower = query.toLowerCase();
    
    if (titleLower === queryLower) return 1000;
    if (titleLower.startsWith(queryLower)) return 900;
    if (titleLower.includes(queryLower)) return 800;
    return 0;
  }),
}));

describe('filterAndSortCommands', () => {
  const commands: CommandPaletteCommand[] = [
    {
      id: 'trial-session',
      title: 'Trial session',
      description: 'Book a new trial session',
      keywords: ['trial', 'book'],
      icon: Calendar,
      action: () => {},
    },
    {
      id: 'tutor-log',
      title: 'Tutor log',
      description: 'Create a new tutor log entry',
      keywords: ['log', 'tutor'],
      icon: FileText,
      action: () => {},
    },
    {
      id: 'drafting',
      title: 'Drafting',
      description: 'Book a drafting session',
      keywords: ['drafting'],
      icon: Calendar,
      action: () => {},
    },
  ];

  it('should return all commands when query is empty', () => {
    const result = filterAndSortCommands(commands, '');
    expect(result).toHaveLength(3);
    expect(result).toEqual(commands);
  });

  it('should filter commands by title', () => {
    const result = filterAndSortCommands(commands, 'Trial');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trial-session');
  });

  it('should filter commands by description', () => {
    const result = filterAndSortCommands(commands, 'entry');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tutor-log');
  });

  it('should filter commands by keywords', () => {
    const result = filterAndSortCommands(commands, 'book');
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toContain('trial-session');
    expect(result.map((c) => c.id)).toContain('drafting');
  });

  it('should sort by match quality: exact match first', () => {
    const result = filterAndSortCommands(commands, 'Trial session');
    expect(result[0].id).toBe('trial-session');
  });

  it('should sort by match quality: starts with before contains', () => {
    const result = filterAndSortCommands(commands, 'Trial');
    expect(result[0].id).toBe('trial-session');
  });

  it('should be case insensitive', () => {
    const result = filterAndSortCommands(commands, 'trial');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('trial-session');
  });

  it('should return empty array when no matches', () => {
    const result = filterAndSortCommands(commands, 'xyz');
    expect(result).toHaveLength(0);
  });
});

describe('filterAndSortPages', () => {
  const pages: CommandPalettePage[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      href: '/dashboard',
      keywords: ['home', 'main'],
      icon: Home,
    },
    {
      id: 'settings',
      title: 'Settings',
      href: '/settings',
      keywords: ['config', 'preferences'],
      icon: Calendar,
    },
    {
      id: 'students',
      title: 'Students',
      href: '/students',
      keywords: [],
      icon: Calendar,
    },
  ];

  it('should return all pages when query is empty', () => {
    const result = filterAndSortPages(pages, '');
    expect(result).toHaveLength(3);
    expect(result).toEqual(pages);
  });

  it('should filter pages by title', () => {
    const result = filterAndSortPages(pages, 'Dashboard');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dashboard');
  });

  it('should filter pages by keywords', () => {
    const result = filterAndSortPages(pages, 'config');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('settings');
  });

  it('should sort by match quality: exact match first', () => {
    const result = filterAndSortPages(pages, 'Dashboard');
    expect(result[0].id).toBe('dashboard');
  });

  it('should sort by match quality: starts with before contains', () => {
    const result = filterAndSortPages(pages, 'Setting');
    expect(result[0].id).toBe('settings');
  });

  it('should be case insensitive', () => {
    const result = filterAndSortPages(pages, 'dashboard');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('dashboard');
  });
});

describe('filterItemsByType', () => {
  const items = [
    {
      type: 'command' as const,
      id: 'cmd-1',
      title: 'Command 1',
      icon: Calendar,
      action: () => {},
    },
    {
      type: 'page' as const,
      id: 'page-1',
      title: 'Page 1',
      href: '/page1',
      icon: Home,
    },
    {
      type: 'entity' as const,
      result: {
        type: 'student' as const,
        id: 'student-1',
        data: {} as Tables<'students'>,
      },
    },
    {
      type: 'entity' as const,
      result: {
        type: 'staff' as const,
        id: 'staff-1',
        data: {} as Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'email' | 'phone_number'>,
      },
    },
  ];

  it('should return all items when filter is null', () => {
    const result = filterItemsByType(items, null);
    expect(result).toHaveLength(4);
  });

  it('should filter by command type', () => {
    const result = filterItemsByType(items, 'command');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('command');
  });

  it('should filter by page type', () => {
    const result = filterItemsByType(items, 'page');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('page');
  });

  it('should filter by entity type', () => {
    const result = filterItemsByType(items, 'student');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('entity');
    if (result[0].type === 'entity') {
      expect(result[0].result.type).toBe('student');
    }
  });

  it('should return empty array when no items match filter', () => {
    const result = filterItemsByType(items, 'topic');
    expect(result).toHaveLength(0);
  });
});

describe('groupItemsByType', () => {
  const entityTypeMapping = {
    student: 'students',
    staff: 'staff',
  };

  const entityTypes = {
    students: { label: 'Students' },
    staff: { label: 'Staff' },
  };

  const items = [
    {
      type: 'command' as const,
      id: 'cmd-1',
      title: 'Command 1',
      icon: Calendar,
      action: () => {},
    },
    {
      type: 'page' as const,
      id: 'page-1',
      title: 'Page 1',
      href: '/page1',
      icon: Home,
    },
    {
      type: 'entity' as const,
      result: {
        type: 'student' as const,
        id: 'student-1',
        data: {} as Tables<'students'>,
      },
    },
    {
      type: 'entity' as const,
      result: {
        type: 'staff' as const,
        id: 'staff-1',
        data: {} as Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'email' | 'phone_number'>,
      },
    },
  ];

  it('should group items by type', () => {
    const result = groupItemsByType(items, 'test', entityTypeMapping, entityTypes);
    
    expect(result).toHaveLength(4); // Commands, Pages, Students, Staff
    expect(result.map((g) => g.label)).toContain('Commands');
    expect(result.map((g) => g.label)).toContain('Pages');
    expect(result.map((g) => g.label)).toContain('Students');
    expect(result.map((g) => g.label)).toContain('Staff');
  });

  it('should include correct items in each group', () => {
    const result = groupItemsByType(items, 'test', entityTypeMapping, entityTypes);
    
    const commandsGroup = result.find((g) => g.label === 'Commands');
    expect(commandsGroup?.items).toHaveLength(1);
    expect(commandsGroup?.items[0].type).toBe('command');

    const pagesGroup = result.find((g) => g.label === 'Pages');
    expect(pagesGroup?.items).toHaveLength(1);
    expect(pagesGroup?.items[0].type).toBe('page');

    const studentsGroup = result.find((g) => g.label === 'Students');
    expect(studentsGroup?.items).toHaveLength(1);
    if (studentsGroup?.items[0].type === 'entity') {
      expect(studentsGroup.items[0].result.type).toBe('student');
    }
  });

  it('should calculate max scores for groups', () => {
    const result = groupItemsByType(items, 'Command', entityTypeMapping, entityTypes);
    
    const commandsGroup = result.find((g) => g.label === 'Commands');
    expect(commandsGroup?.maxScore).toBeGreaterThan(0);
  });

  it('should sort groups by max score (highest first)', () => {
    const result = groupItemsByType(items, 'Command', entityTypeMapping, entityTypes);
    
    // Commands group should be first since it matches the query
    expect(result[0].label).toBe('Commands');
  });

  it('should handle empty items array', () => {
    const result = groupItemsByType([], 'test', entityTypeMapping, entityTypes);
    expect(result).toHaveLength(0);
  });
});
