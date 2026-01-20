/**
 * Tests for activity-processor utility functions
 * These tests directly test the utils.ts file logic
 */

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  evaluateConditions,
  replaceTemplateVariables,
  formatTime,
  formatDayOfWeek,
  formatDate,
  formatDateTime,
  formatClassName,
} from '../utils.ts';

describe('evaluateConditions', () => {
  describe('empty or invalid conditions', () => {
    it('should return true for empty conditions', () => {
      const result = evaluateConditions({}, {}, {});
      expect(result).toBe(true);
    });

    it('should return true for null conditions', () => {
      const result = evaluateConditions(null, {}, {});
      expect(result).toBe(true);
    });

    it('should return true for conditions without field or operator', () => {
      const conditions = { value: 'test' };
      const result = evaluateConditions(conditions, {}, {});
      expect(result).toBe(true);
    });
  });

  describe('field change operators (UPDATE events)', () => {
    const updateEvent = {
      event_type: 'UPDATED',
      changed_fields: {
        status: {
          old: 'PENDING',
          new: 'CONFIRMED',
        },
      },
    };

    it('should return true for field_changed operator', () => {
      const conditions = {
        field: 'status',
        operator: 'field_changed',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(true);
    });

    it('should return false for field_changed on non-UPDATE event', () => {
      const createdEvent = {
        event_type: 'CREATED',
        changed_fields: {},
      };
      const conditions = {
        field: 'status',
        operator: 'field_changed',
      };
      const result = evaluateConditions(conditions, createdEvent, {});
      expect(result).toBe(false);
    });

    it('should return true for changed_from when old value matches', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from',
        value: 'PENDING',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(true);
    });

    it('should return false for changed_from when old value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from',
        value: 'CANCELLED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return true for changed_to when new value matches', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_to',
        value: 'CONFIRMED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(true);
    });

    it('should return false for changed_to when new value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_to',
        value: 'CANCELLED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return true for changed_from_to when both values match', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from_to',
        old_value: 'PENDING',
        new_value: 'CONFIRMED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(true);
    });

    it('should return false for changed_from_to when old value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from_to',
        old_value: 'CANCELLED',
        new_value: 'CONFIRMED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return false for changed_from_to when new value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from_to',
        old_value: 'PENDING',
        new_value: 'CANCELLED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return false for changed_from when value is undefined', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return false for changed_to when value is undefined', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_to',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return false for changed_from_to when old_value is undefined', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from_to',
        new_value: 'CONFIRMED',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });

    it('should return false for changed_from_to when new_value is undefined', () => {
      const conditions = {
        field: 'status',
        operator: 'changed_from_to',
        old_value: 'PENDING',
      };
      const result = evaluateConditions(conditions, updateEvent, {});
      expect(result).toBe(false);
    });
  });

  describe('standard operators (CREATED events or current state)', () => {
    const createdEvent = {
      event_type: 'CREATED',
      changed_fields: {},
    };

    const entityData = {
      status: 'ACTIVE',
      count: 5,
      name: 'Test Item',
    };

    it('should return true for equals when value matches', () => {
      const conditions = {
        field: 'status',
        operator: 'equals',
        value: 'ACTIVE',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for equals when value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'equals',
        value: 'INACTIVE',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return false for equals when value is undefined', () => {
      const conditions = {
        field: 'status',
        operator: 'equals',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return true for not_equals when value does not match', () => {
      const conditions = {
        field: 'status',
        operator: 'not_equals',
        value: 'INACTIVE',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for not_equals when value matches', () => {
      const conditions = {
        field: 'status',
        operator: 'not_equals',
        value: 'ACTIVE',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return true for contains when string contains value', () => {
      const conditions = {
        field: 'name',
        operator: 'contains',
        value: 'Test',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for contains when string does not contain value', () => {
      const conditions = {
        field: 'name',
        operator: 'contains',
        value: 'Other',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return true for not_contains when string does not contain value', () => {
      const conditions = {
        field: 'name',
        operator: 'not_contains',
        value: 'Other',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for not_contains when string contains value', () => {
      const conditions = {
        field: 'name',
        operator: 'not_contains',
        value: 'Test',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return true for greater_than when value is greater', () => {
      const conditions = {
        field: 'count',
        operator: 'greater_than',
        value: 3,
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for greater_than when value is not greater', () => {
      const conditions = {
        field: 'count',
        operator: 'greater_than',
        value: 10,
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return true for less_than when value is less', () => {
      const conditions = {
        field: 'count',
        operator: 'less_than',
        value: 10,
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should return false for less_than when value is not less', () => {
      const conditions = {
        field: 'count',
        operator: 'less_than',
        value: 3,
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should return false for unknown operator', () => {
      const conditions = {
        field: 'status',
        operator: 'unknown_operator',
        value: 'ACTIVE',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });

    it('should handle string conversion for equals', () => {
      const conditions = {
        field: 'count',
        operator: 'equals',
        value: '5',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(true);
    });

    it('should handle null/undefined field values', () => {
      const entityDataWithNull = {
        status: null,
      };
      const conditions = {
        field: 'status',
        operator: 'equals',
        value: 'ACTIVE',
      };
      const result = evaluateConditions(
        conditions,
        createdEvent,
        entityDataWithNull
      );
      expect(result).toBe(false);
    });

    it('should handle missing field in entityData', () => {
      const conditions = {
        field: 'missing_field',
        operator: 'equals',
        value: 'test',
      };
      const result = evaluateConditions(conditions, createdEvent, entityData);
      expect(result).toBe(false);
    });
  });
});

describe('replaceTemplateVariables', () => {
  it('should replace single variable', () => {
    const template = 'Hello {first_name}';
    const variables = { first_name: 'John' };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello John');
  });

  it('should replace multiple variables', () => {
    const template = 'Hello {first_name} {last_name}';
    const variables = {
      first_name: 'John',
      last_name: 'Doe',
    };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello John Doe');
  });

  it('should be case-insensitive', () => {
    const template = 'Hello {FIRST_NAME}';
    const variables = { first_name: 'John' };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello John');
  });

  it('should replace all occurrences', () => {
    const template = '{name} said hello to {name}';
    const variables = { name: 'John' };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('John said hello to John');
  });

  it('should handle empty string values', () => {
    const template = 'Hello {first_name}';
    const variables = { first_name: '' };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello ');
  });

  it('should handle null/undefined values', () => {
    const template = 'Hello {first_name}';
    const variables = { first_name: null };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello ');
  });

  it('should convert non-string values to strings', () => {
    const template = 'Count: {count}';
    const variables = { count: 42 };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Count: 42');
  });

  it('should convert escaped newlines to actual newlines', () => {
    const template = 'Line 1\\nLine 2';
    const variables = {};
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Line 1\nLine 2');
  });

  it('should handle multiple escaped newlines', () => {
    const template = 'Line 1\\nLine 2\\nLine 3';
    const variables = {};
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should leave unmatched variables as-is', () => {
    const template = 'Hello {first_name} {unknown}';
    const variables = { first_name: 'John' };
    const result = replaceTemplateVariables(template, variables);
    expect(result).toBe('Hello John {unknown}');
  });
});

describe('formatTime', () => {
  it('should format 24-hour time to 12-hour format', () => {
    expect(formatTime('14:30')).toBe('2:30 PM');
    expect(formatTime('09:15')).toBe('9:15 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('23:59')).toBe('11:59 PM');
  });

  it('should handle time with seconds', () => {
    expect(formatTime('14:30:45')).toBe('2:30 PM');
  });
});

describe('formatDayOfWeek', () => {
  it('should format day numbers to short names', () => {
    expect(formatDayOfWeek(0)).toBe('Sun');
    expect(formatDayOfWeek(1)).toBe('Mon');
    expect(formatDayOfWeek(2)).toBe('Tue');
    expect(formatDayOfWeek(3)).toBe('Wed');
    expect(formatDayOfWeek(4)).toBe('Thu');
    expect(formatDayOfWeek(5)).toBe('Fri');
    expect(formatDayOfWeek(6)).toBe('Sat');
  });

  it('should return empty string for null', () => {
    expect(formatDayOfWeek(null)).toBe('');
  });

  it('should return empty string for undefined', () => {
    expect(formatDayOfWeek(undefined)).toBe('');
  });

  it('should return empty string for invalid day number', () => {
    expect(formatDayOfWeek(7)).toBe('');
    expect(formatDayOfWeek(-1)).toBe('');
  });
});

describe('formatDate', () => {
  it('should format valid timestamp', () => {
    const result = formatDate('2024-01-15T10:00:00Z');
    expect(result).toContain('2024');
    expect(result).toContain('January');
    expect(result).toContain('15');
  });

  it('should return empty string for invalid timestamp', () => {
    const result = formatDate('not-a-date');
    expect(result).toBe('');
  });
});

describe('formatDateTime', () => {
  it('should format valid timestamp to time', () => {
    const result = formatDateTime('2024-01-15T14:30:00Z');
    // Should contain time components
    expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
  });

  it('should return empty string for invalid timestamp', () => {
    const result = formatDateTime('not-a-date');
    expect(result).toBe('');
  });
});

describe('formatClassName', () => {
  const mockSubject = {
    long_name: 'VCE Mathematics',
  };

  const mockClass = {
    day_of_week: 1,
    start_time: '09:00',
    end_time: '10:30',
  };

  it('should format class name with all parts', () => {
    const result = formatClassName(mockClass, mockSubject);
    expect(result).toContain('VCE Mathematics');
    expect(result).toContain('Mon');
    expect(result).toContain('9:00 AM');
    expect(result).toContain('10:30 AM');
  });

  it('should format class name without day of week', () => {
    const classWithoutDay = {
      ...mockClass,
      day_of_week: null,
    };
    const result = formatClassName(classWithoutDay, mockSubject);
    expect(result).toContain('VCE Mathematics');
    expect(result).not.toContain('Mon');
  });

  it('should format class name without times', () => {
    const classWithoutTimes = {
      ...mockClass,
      start_time: null,
      end_time: null,
    };
    const result = formatClassName(classWithoutTimes, mockSubject);
    expect(result).toBe('VCE Mathematics Mon');
  });

  it('should format class name without subject', () => {
    const result = formatClassName(mockClass, null);
    expect(result).toContain('Mon');
    expect(result).toContain('9:00 AM');
  });
});
