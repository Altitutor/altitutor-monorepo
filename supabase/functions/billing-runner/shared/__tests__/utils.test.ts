/**
 * Tests for billing utility functions
 * These tests directly test the utils.ts file logic
 */

import { describe, it } from 'jsr:@std/testing/bdd';
import { expect } from 'jsr:@std/expect';
import {
  getClassLongName,
  generateInvoiceItemIdempotencyKey,
  formatSessionDate,
} from '../utils.ts';

describe('getClassLongName', () => {
  const mockSubject = {
    id: 'subj-1',
    curriculum: 'VCE',
    year_level: 12,
    name: 'Mathematics',
  };

  const mockClass = {
    id: 'class-1',
    level: 'A',
  };

  it('should build full class name with all parts', () => {
    const session = {
      class_id: 'class-1',
      subject_id: 'subj-1',
    };

    const classById = { 'class-1': mockClass };
    const subjectById = { 'subj-1': mockSubject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('VCE 12 Mathematics A');
  });

  it('should build name without class level', () => {
    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': mockSubject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('VCE 12 Mathematics');
  });

  it('should build name without curriculum', () => {
    const subject = {
      ...mockSubject,
      curriculum: null,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('12 Mathematics');
  });

  it('should build name without year level', () => {
    const subject = {
      ...mockSubject,
      year_level: null,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('VCE Mathematics');
  });

  it('should return subject name only if no other parts', () => {
    const subject = {
      ...mockSubject,
      curriculum: null,
      year_level: null,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('Mathematics');
  });

  it('should return "Session" if no subject', () => {
    const session = {
      class_id: 'class-1',
    };

    const classById = { 'class-1': mockClass };
    const subjectById = {};

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('Session');
  });

  it('should return subject name as fallback if no parts', () => {
    const subject = {
      id: 'subj-1',
      name: 'Math',
      curriculum: null,
      year_level: null,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('Math');
  });

  it('should return "Session" if subject has no name', () => {
    const subject = {
      id: 'subj-1',
      name: null,
      curriculum: null,
      year_level: null,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('Session');
  });

  it('should handle numeric year_level correctly', () => {
    const subject = {
      ...mockSubject,
      year_level: 10,
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('VCE 10 Mathematics');
  });

  it('should handle string year_level correctly', () => {
    const subject = {
      ...mockSubject,
      year_level: '10',
    };

    const session = {
      subject_id: 'subj-1',
    };

    const classById = {};
    const subjectById = { 'subj-1': subject };

    const result = getClassLongName(session, classById, subjectById);
    expect(result).toBe('VCE 10 Mathematics');
  });
});

describe('generateInvoiceItemIdempotencyKey', () => {
  const baseItem = {
    amount_cents: 10000,
    description: 'Test session',
  };

  const studentId = 'student-123';
  const invoiceDate = '2024-01-15';
  const timestamp = 1234567890;

  it('should generate stable key for session item with sessions_students_id', () => {
    const item = {
      ...baseItem,
      sessions_students_id: 'session-student-456',
    };

    const result = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      timestamp
    );

    expect(result).toBe(
      `invoice_item_session-student-456_main-charge_${item.amount_cents}_${invoiceDate}`
    );
  });

  it('should ignore description for idempotency key hashing', () => {
    const item = {
      ...baseItem,
      sessions_students_id: 'session-student-456',
      description: 'A'.repeat(100),
    };

    const result = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      timestamp
    );

    expect(result).toBe(
      `invoice_item_session-student-456_main-charge_${item.amount_cents}_${invoiceDate}`
    );
  });

  it('should differentiate fee vs main items by flag in key', () => {
    const item = {
      ...baseItem,
      sessions_students_id: 'session-student-456',
      is_fee: true,
    };

    const result = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      timestamp
    );

    expect(result).toBe(
      `invoice_item_session-student-456_fee-charge_${item.amount_cents}_${invoiceDate}`
    );
  });

  it('should generate key for fee item without sessions_students_id', () => {
    const item = {
      ...baseItem,
      is_fee: true,
    };

    const result = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      timestamp
    );

    expect(result).toBe(
      `invoice_item_fee_${studentId}_${invoiceDate}_${item.amount_cents}_${timestamp}`
    );
  });

  it('should include different amounts in fee item key', () => {
    const item1 = {
      ...baseItem,
      amount_cents: 5000,
    };

    const item2 = {
      ...baseItem,
      amount_cents: 10000,
    };

    const key1 = generateInvoiceItemIdempotencyKey(
      item1,
      studentId,
      invoiceDate,
      timestamp
    );

    const key2 = generateInvoiceItemIdempotencyKey(
      item2,
      studentId,
      invoiceDate,
      timestamp
    );

    expect(key1).not.toBe(key2);
    expect(key1).toContain('5000');
    expect(key2).toContain('10000');
  });

  it('should generate unique keys for different fee item timestamps', () => {
    const item = {
      ...baseItem,
      sessions_students_id: 'session-student-456',
    };

    const key1 = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      1234567890
    );

    const key2 = generateInvoiceItemIdempotencyKey(
      item,
      studentId,
      invoiceDate,
      9876543210
    );

    expect(key1).not.toBe(key2);
  });
});

describe('formatSessionDate', () => {
  it('should format date in Adelaide timezone', () => {
    const startAt = '2024-01-15T10:00:00Z';
    const result = formatSessionDate(startAt);

    // Should contain date components
    expect(result).toContain('2024');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
  });

  it('should return original string on parse error', () => {
    const invalidDate = 'not-a-date';
    const result = formatSessionDate(invalidDate);

    expect(result).toBe('not-a-date');
  });

  it('should handle valid ISO date strings', () => {
    const startAt = '2024-12-25T14:30:00Z';
    const result = formatSessionDate(startAt);

    expect(result).toContain('2024');
    expect(result).toContain('Dec');
    expect(result).toContain('25');
  });
});
