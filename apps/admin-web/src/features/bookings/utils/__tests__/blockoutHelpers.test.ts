import { getStaffNameFromBlockout } from '../blockoutHelpers';
import type { BlockoutRow } from '../../api/blockouts';

describe('blockoutHelpers', () => {
  describe('getStaffNameFromBlockout', () => {
    it('should extract staff name from blockout with staff relation', () => {
      const blockout: BlockoutRow = {
        id: '1',
        staff_id: 'staff-1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
        created_at: new Date().toISOString(),
        created_by: null,
        reason: null,
        staff: {
          first_name: 'John',
          last_name: 'Doe',
        },
      } as BlockoutRow;

      const result = getStaffNameFromBlockout(blockout, 'staff-1');
      expect(result).toBe('John Doe');
    });

    it('should return "Unknown" when staff relation is missing', () => {
      const blockout: BlockoutRow = {
        id: '1',
        staff_id: 'staff-1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
        created_at: new Date().toISOString(),
        created_by: null,
        reason: null,
      } as BlockoutRow;

      const result = getStaffNameFromBlockout(blockout, 'staff-1');
      expect(result).toBe('Unknown');
    });

    it('should return "Unknown" when staff relation is null', () => {
      const blockout: BlockoutRow = {
        id: '1',
        staff_id: 'staff-1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
        created_at: new Date().toISOString(),
        created_by: null,
        reason: null,
        staff: null,
      } as BlockoutRow;

      const result = getStaffNameFromBlockout(blockout, 'staff-1');
      expect(result).toBe('Unknown');
    });

    it('should handle staff with only first name', () => {
      const blockout: BlockoutRow = {
        id: '1',
        staff_id: 'staff-1',
        start_at: '2024-01-15T10:00:00Z',
        end_at: '2024-01-15T11:00:00Z',
        created_at: new Date().toISOString(),
        created_by: null,
        reason: null,
        staff: {
          first_name: 'John',
          last_name: '',
        },
      } as BlockoutRow;

      const result = getStaffNameFromBlockout(blockout, 'staff-1');
      expect(result).toBe('John ');
    });
  });
});
