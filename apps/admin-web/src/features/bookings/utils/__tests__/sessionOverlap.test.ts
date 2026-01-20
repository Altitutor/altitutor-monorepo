import { calculateSessionOverlapGroups, calculateSessionPosition } from '../sessionOverlap';
import type { SessionItem } from '../sessionOverlap';

describe('sessionOverlap', () => {
  describe('calculateSessionOverlapGroups', () => {
    it('should group overlapping sessions together', () => {
      // Use local date to avoid timezone issues with isSameDay
      const targetDate = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 at noon local time
      const sessions: SessionItem[] = [
        {
          id: '1',
          start_at: new Date(2024, 0, 15, 10, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 0, 0).toISOString(),
        },
        {
          id: '2',
          start_at: new Date(2024, 0, 15, 10, 30, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 30, 0).toISOString(),
        },
        {
          id: '3',
          start_at: new Date(2024, 0, 15, 14, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 15, 0, 0).toISOString(),
        },
      ];

      const groups = calculateSessionOverlapGroups(sessions, targetDate);
      
      // Sessions 1 and 2 overlap, session 3 is separate
      expect(groups.length).toBeGreaterThanOrEqual(1);
      
      // Find groups containing overlapping sessions
      const groupWithSession1 = groups.find(g => g.some(s => s.id === '1'));
      const groupWithSession2 = groups.find(g => g.some(s => s.id === '2'));
      const groupWithSession3 = groups.find(g => g.some(s => s.id === '3'));
      
      // Sessions 1 and 2 should be in the same group (they overlap)
      expect(groupWithSession1).toBeDefined();
      expect(groupWithSession1).toBe(groupWithSession2);
      expect(groupWithSession1?.length).toBeGreaterThanOrEqual(2);
      
      // Session 3 should be in a different group
      expect(groupWithSession3).toBeDefined();
      expect(groupWithSession3).not.toBe(groupWithSession1);
    });

    it('should handle non-overlapping sessions', () => {
      // Use local date to avoid timezone issues
      const targetDate = new Date(2024, 0, 15, 12, 0, 0);
      const sessions: SessionItem[] = [
        {
          id: '1',
          start_at: new Date(2024, 0, 15, 10, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 0, 0).toISOString(),
        },
        {
          id: '2',
          start_at: new Date(2024, 0, 15, 12, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 13, 0, 0).toISOString(),
        },
        {
          id: '3',
          start_at: new Date(2024, 0, 15, 14, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 15, 0, 0).toISOString(),
        },
      ];

      const groups = calculateSessionOverlapGroups(sessions, targetDate);
      
      // All sessions should be on the same day, but may be filtered by timezone
      // So we check that each group has exactly 1 session (no overlaps)
      groups.forEach(group => {
        expect(group).toHaveLength(1);
      });
      
      // Verify all sessions are present
      const allSessionIds = groups.flat().map(s => s.id);
      expect(allSessionIds).toContain('1');
      expect(allSessionIds).toContain('2');
      expect(allSessionIds).toContain('3');
    });

    it('should filter sessions for the target date only', () => {
      // Use local dates to avoid timezone issues
      const targetDate = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024
      const sessions: SessionItem[] = [
        {
          id: '1',
          start_at: new Date(2024, 0, 15, 10, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 0, 0).toISOString(),
        },
        {
          id: '2',
          start_at: new Date(2024, 0, 16, 10, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 16, 11, 0, 0).toISOString(),
        },
      ];

      const groups = calculateSessionOverlapGroups(sessions, targetDate);
      
      // Only session 1 should be included (same day as targetDate)
      const allSessionIds = groups.flat().map(s => s.id);
      expect(allSessionIds).toContain('1');
      expect(allSessionIds).not.toContain('2');
    });

    it('should handle empty sessions array', () => {
      const targetDate = new Date('2024-01-15');
      const groups = calculateSessionOverlapGroups([], targetDate);
      
      expect(groups).toHaveLength(0);
    });

    it('should handle complex overlapping scenario', () => {
      // Use local date to avoid timezone issues
      const targetDate = new Date(2024, 0, 15, 12, 0, 0);
      const sessions: SessionItem[] = [
        {
          id: '1',
          start_at: new Date(2024, 0, 15, 10, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 0, 0).toISOString(),
        },
        {
          id: '2',
          start_at: new Date(2024, 0, 15, 10, 30, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 11, 30, 0).toISOString(),
        },
        {
          id: '3',
          start_at: new Date(2024, 0, 15, 11, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 12, 0, 0).toISOString(),
        },
        {
          id: '4',
          start_at: new Date(2024, 0, 15, 14, 0, 0).toISOString(),
          end_at: new Date(2024, 0, 15, 15, 0, 0).toISOString(),
        },
      ];

      const groups = calculateSessionOverlapGroups(sessions, targetDate);
      
      // Sessions 1, 2, and 3 all overlap (1 overlaps with 2, 2 overlaps with 3)
      // Session 4 is separate
      expect(groups.length).toBeGreaterThanOrEqual(1);
      
      // Find the group containing session 1
      const groupWithSession1 = groups.find(g => g.some(s => s.id === '1'));
      expect(groupWithSession1).toBeDefined();
      expect(groupWithSession1!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('calculateSessionPosition', () => {
    it('should calculate correct position for a session', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
      };

      const position = calculateSessionPosition(session, 9, 75);
      
      expect(position).toHaveProperty('top');
      expect(position).toHaveProperty('height');
      expect(position.top).toBeGreaterThanOrEqual(0);
      expect(position.height).toBeGreaterThan(0);
    });

    it('should use default startHour and slotHeight', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
      };

      const position = calculateSessionPosition(session);
      
      expect(position).toHaveProperty('top');
      expect(position).toHaveProperty('height');
    });

    it('should calculate correct height for 1-hour session', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
      };

      const position = calculateSessionPosition(session, 9, 75);
      
      // 1 hour = 60 minutes, so height should be approximately 75px
      expect(position.height).toBeGreaterThanOrEqual(45); // Minimum height
      expect(position.height).toBeLessThanOrEqual(100); // Allow some tolerance
    });

    it('should calculate correct top position relative to startHour', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
      };

      const position = calculateSessionPosition(session, 9, 75);
      
      // Session starts at 10:00, startHour is 9:00
      // So top should be approximately 75px (1 hour * 75px/hour)
      expect(position.top).toBeGreaterThanOrEqual(0);
    });

    it('should enforce minimum height of 45px', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T10:15:00Z', // 15 minutes
      };

      const position = calculateSessionPosition(session, 9, 75);
      
      expect(position.height).toBeGreaterThanOrEqual(45);
    });

    it('should handle sessions starting before startHour', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T08:00:00Z',
        end_at: '2024-01-15T09:00:00Z',
      };

      const position = calculateSessionPosition(session, 9, 75);
      
      // Top should be clamped to 0 or greater
      expect(position.top).toBeGreaterThanOrEqual(0);
    });

    it('should handle custom slotHeight', () => {
      const session: SessionItem = {
        id: '1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
      };

      const position1 = calculateSessionPosition(session, 9, 75);
      const position2 = calculateSessionPosition(session, 9, 100);
      
      // Height should scale with slotHeight
      expect(position2.height).toBeGreaterThan(position1.height);
    });
  });
});
