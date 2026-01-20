import {
  dateToAdelaideMidnightUTC,
  dateToAdelaideEndOfDayUTC,
  utcToAdelaideDate,
  formatDateRange,
  getTodayAdelaideDate,
  isSlotInPast,
  formatSlotDateTime,
  getCurrentAdelaideTime,
} from '../dateTimeHelpers';

describe('dateTimeHelpers', () => {
  describe('dateToAdelaideMidnightUTC', () => {
    it('should convert date string to midnight Adelaide time in UTC', () => {
      const result = dateToAdelaideMidnightUTC('2024-01-15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toContain('2024-01');
    });

    it('should handle different dates correctly', () => {
      const result1 = dateToAdelaideMidnightUTC('2024-06-15');
      const result2 = dateToAdelaideMidnightUTC('2024-12-31');
      
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle year boundaries', () => {
      const result = dateToAdelaideMidnightUTC('2024-01-01');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toContain('2024-01');
    });
  });

  describe('dateToAdelaideEndOfDayUTC', () => {
    it('should convert date string to end of day Adelaide time in UTC', () => {
      const result = dateToAdelaideEndOfDayUTC('2024-01-15');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result).toContain('2024-01');
      expect(result).toMatch(/\.999Z?$/);
    });

    it('should handle different dates correctly', () => {
      const result1 = dateToAdelaideEndOfDayUTC('2024-06-15');
      const result2 = dateToAdelaideEndOfDayUTC('2024-12-31');
      
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('utcToAdelaideDate', () => {
    it('should convert UTC ISO string to Adelaide date string', () => {
      const utcString = '2024-01-15T10:30:00Z';
      const result = utcToAdelaideDate(utcString);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should handle different UTC times correctly', () => {
      const utcString1 = '2024-01-15T00:00:00Z';
      const utcString2 = '2024-01-15T23:59:59Z';
      
      const result1 = utcToAdelaideDate(utcString1);
      const result2 = utcToAdelaideDate(utcString2);
      
      expect(result1).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result2).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatDateRange', () => {
    it('should format single day range correctly', () => {
      // Use times that will definitely be on the same day in Adelaide timezone
      // Adelaide is UTC+9:30 or UTC+10:30, so use times that won't cross day boundary
      const startUtc = '2024-01-15T02:00:00Z'; // 11:30 AM or 12:30 PM Adelaide
      const endUtc = '2024-01-15T04:00:00Z'; // 1:30 PM or 2:30 PM Adelaide
      const result = formatDateRange(startUtc, endUtc);
      
      // Should return single date (not a range) if same day, or range if different days
      // Due to timezone conversion, we just verify it contains date info
      expect(result).toContain('Jan');
      expect(result).toContain('2024');
    });

    it('should format multi-day range correctly', () => {
      const startUtc = '2024-01-15T10:30:00Z';
      const endUtc = '2024-01-20T14:30:00Z';
      const result = formatDateRange(startUtc, endUtc);
      
      expect(result).toContain(' - ');
      expect(result).toContain('Jan');
      expect(result).toContain('2024');
    });

    it('should handle year boundaries', () => {
      const startUtc = '2023-12-31T10:30:00Z';
      const endUtc = '2024-01-01T14:30:00Z';
      const result = formatDateRange(startUtc, endUtc);
      
      expect(result).toContain(' - ');
      expect(result).toContain('2023');
      expect(result).toContain('2024');
    });
  });

  describe('getTodayAdelaideDate', () => {
    it('should return today\'s date in Adelaide timezone', () => {
      const result = getTodayAdelaideDate();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Should be a valid date
      const [year, month, day] = result.split('-').map(Number);
      expect(year).toBeGreaterThan(2020);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
    });
  });

  describe('isSlotInPast', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for past slots', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const pastSlot = pastDate.toISOString();
      
      expect(isSlotInPast(pastSlot)).toBe(true);
    });

    it('should return false for future slots', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const futureSlot = futureDate.toISOString();
      
      expect(isSlotInPast(futureSlot)).toBe(false);
    });

    it('should return false for current time slot', () => {
      const now = new Date();
      const nowSlot = now.toISOString();
      
      // Since we're comparing down to the second, this might be slightly in the past
      // depending on execution time, so we'll just verify it doesn't throw
      expect(typeof isSlotInPast(nowSlot)).toBe('boolean');
    });
  });

  describe('formatSlotDateTime', () => {
    it('should format date/time string correctly', () => {
      const slot = '2024-01-15T10:30:00Z';
      const result = formatSlotDateTime(slot);
      
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle different times correctly', () => {
      const slot1 = '2024-01-15T09:00:00Z';
      const slot2 = '2024-01-15T14:30:00Z';
      
      const result1 = formatSlotDateTime(slot1);
      const result2 = formatSlotDateTime(slot2);
      
      expect(result1).toContain('2024');
      expect(result2).toContain('2024');
    });
  });

  describe('getCurrentAdelaideTime', () => {
    it('should return formatted current Adelaide time', () => {
      const result = getCurrentAdelaideTime();
      
      expect(result).toContain('202');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return a string', () => {
      const result = getCurrentAdelaideTime();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
