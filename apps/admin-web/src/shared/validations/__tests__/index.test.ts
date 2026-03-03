/**
 * Tests for validation schemas and utilities
 * Tests Zod schemas for form validation
 */

import { z } from 'zod';
import {
  baseSchemas,
  studentSchema,
  tutorSchema,
  classSchema,
  paymentSchema,
  createFormSchema,
  validateField,
} from '../index';

describe('baseSchemas', () => {
  describe('name', () => {
    it('should validate valid names', () => {
      expect(() => baseSchemas.name.parse('John Doe')).not.toThrow();
      expect(() => baseSchemas.name.parse('Jane')).not.toThrow();
    });

    it('should reject names shorter than 2 characters', () => {
      expect(() => baseSchemas.name.parse('J')).toThrow();
      expect(() => baseSchemas.name.parse('')).toThrow();
    });

    it('should reject names longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => baseSchemas.name.parse(longName)).toThrow();
    });
  });

  describe('email', () => {
    it('should validate valid email addresses', () => {
      expect(() => baseSchemas.email.parse('john@example.com')).not.toThrow();
      expect(() => baseSchemas.email.parse('jane.doe@test.co.uk')).not.toThrow();
    });

    it('should reject invalid email addresses', () => {
      expect(() => baseSchemas.email.parse('invalid')).toThrow();
      expect(() => baseSchemas.email.parse('invalid@')).toThrow();
      expect(() => baseSchemas.email.parse('@example.com')).toThrow();
    });
  });

  describe('phone', () => {
    it('should validate valid phone numbers', () => {
      expect(() => baseSchemas.phone.parse('+61412345678')).not.toThrow();
      expect(() => baseSchemas.phone.parse('+1234567890')).not.toThrow();
      expect(() => baseSchemas.phone.parse('123')).not.toThrow(); // Valid according to regex (1-9 followed by 1-14 digits)
    });

    it('should reject invalid phone numbers', () => {
      expect(() => baseSchemas.phone.parse('0412345678')).toThrow(); // Starts with 0, not 1-9
      expect(() => baseSchemas.phone.parse('abc')).toThrow();
      expect(() => baseSchemas.phone.parse('0123456789')).toThrow(); // Starts with 0
      expect(() => baseSchemas.phone.parse('+0123456789')).toThrow(); // Starts with 0 after +
    });
  });

  describe('date', () => {
    it('should validate valid dates', () => {
      expect(() => baseSchemas.date.parse(new Date())).not.toThrow();
      expect(() => baseSchemas.date.parse(new Date('2024-01-15'))).not.toThrow();
    });

    it('should reject invalid dates', () => {
      expect(() => baseSchemas.date.parse('not-a-date')).toThrow();
      expect(() => baseSchemas.date.parse(null)).toThrow();
    });
  });

  describe('futureDate', () => {
    it('should validate future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => baseSchemas.futureDate.parse(futureDate)).not.toThrow();
    });

    it('should reject past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(() => baseSchemas.futureDate.parse(pastDate)).toThrow();
    });
  });

  describe('pastDate', () => {
    it('should validate past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(() => baseSchemas.pastDate.parse(pastDate)).not.toThrow();
    });

    it('should reject future dates', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => baseSchemas.pastDate.parse(futureDate)).toThrow();
    });
  });

  describe('numeric', () => {
    it('should validate numbers', () => {
      expect(() => baseSchemas.numeric.parse(123)).not.toThrow();
      expect(() => baseSchemas.numeric.parse(0)).not.toThrow();
      expect(() => baseSchemas.numeric.parse(-5)).not.toThrow();
    });

    it('should reject non-numbers', () => {
      expect(() => baseSchemas.numeric.parse('123')).toThrow();
      expect(() => baseSchemas.numeric.parse(null)).toThrow();
    });
  });
});

describe('studentSchema', () => {
  it('should validate valid student data', () => {
    const validStudent = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+61412345678',
      dateOfBirth: new Date('2010-01-15'),
      schoolName: 'Test School',
      yearLevel: 10,
      subjects: ['subject-1'],
      parentName: 'Jane Doe',
      parentEmail: 'jane@example.com',
      parentPhone: '+61412345679',
    };

    expect(() => studentSchema.parse(validStudent)).not.toThrow();
  });

  it('should allow optional phone', () => {
    const studentWithoutPhone = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      dateOfBirth: new Date('2010-01-15'),
      schoolName: 'Test School',
      yearLevel: 10,
      subjects: ['subject-1'],
      parentName: 'Jane Doe',
      parentEmail: 'jane@example.com',
      parentPhone: '+61412345679',
    };

    expect(() => studentSchema.parse(studentWithoutPhone)).not.toThrow();
  });

  it('should reject invalid student data', () => {
    const invalidStudent = {
      firstName: 'J', // Too short
      lastName: 'Doe',
      email: 'invalid-email',
      dateOfBirth: new Date('2030-01-15'), // Future date
      schoolName: '',
      yearLevel: 15, // Invalid year level
      subjects: [], // Empty subjects
      parentName: 'Jane',
      parentEmail: 'jane@example.com',
      parentPhone: '+61412345679',
    };

    expect(() => studentSchema.parse(invalidStudent)).toThrow();
  });
});

describe('tutorSchema', () => {
  it('should validate valid tutor data', () => {
    const validTutor = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+61412345678',
      dateOfBirth: new Date('1990-01-15'),
      subjects: ['subject-1'],
      availability: [
        { day: 'monday', startTime: '09:00', endTime: '17:00' },
      ],
      qualifications: [
        { degree: 'Bachelor', institution: 'University', yearCompleted: 2012 },
      ],
    };

    expect(() => tutorSchema.parse(validTutor)).not.toThrow();
  });

  it('should reject tutor without subjects', () => {
    const invalidTutor = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+61412345678',
      dateOfBirth: new Date('1990-01-15'),
      subjects: [],
      availability: [],
      qualifications: [],
    };

    expect(() => tutorSchema.parse(invalidTutor)).toThrow();
  });
});

describe('classSchema', () => {
  it('should validate valid class data', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const validClass = {
      subject: 'subject-1',
      startDate: futureDate,
      endDate: futureDate,
      startTime: '09:00',
      endTime: '10:00',
      students: ['student-1'],
      tutor: 'tutor-1',
      location: 'Room 1',
    };

    expect(() => classSchema.parse(validClass)).not.toThrow();
  });

  it('should reject class without students', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);

    const invalidClass = {
      subject: 'subject-1',
      startDate: futureDate,
      endDate: futureDate,
      startTime: '09:00',
      endTime: '10:00',
      students: [],
      tutor: 'tutor-1',
      location: 'Room 1',
    };

    expect(() => classSchema.parse(invalidClass)).toThrow();
  });
});

describe('paymentSchema', () => {
  it('should validate valid payment data', () => {
    const validPayment = {
      student: 'student-1',
      amount: 100.50,
      paymentDate: new Date(),
      paymentMethod: 'card' as const,
      invoiceNumber: 'INV-001',
    };

    expect(() => paymentSchema.parse(validPayment)).not.toThrow();
  });

  it('should reject negative amounts', () => {
    const invalidPayment = {
      student: 'student-1',
      amount: -100,
      paymentDate: new Date(),
      paymentMethod: 'card' as const,
    };

    expect(() => paymentSchema.parse(invalidPayment)).toThrow();
  });

  it('should allow optional invoice number', () => {
    const paymentWithoutInvoice = {
      student: 'student-1',
      amount: 100,
      paymentDate: new Date(),
      paymentMethod: 'cash' as const,
    };

    expect(() => paymentSchema.parse(paymentWithoutInvoice)).not.toThrow();
  });
});

describe('createFormSchema', () => {
  it('should create a custom form schema', () => {
    const customSchema = createFormSchema({
      name: z.string().min(1),
      age: z.number().min(0),
    });

    expect(() => customSchema.parse({ name: 'John', age: 30 })).not.toThrow();
    expect(() => customSchema.parse({ name: '', age: 30 })).toThrow();
  });
});

describe('validateField', () => {
  it('should return success for valid value', async () => {
    const schema = z.string().min(3);
    const result = await validateField(schema, 'valid');

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return error for invalid value', async () => {
    const schema = z.string().min(3);
    const result = await validateField(schema, 'ab');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle non-Zod errors', async () => {
    // Pass a function that will throw a non-Zod error
    const throwingSchema = {
      parseAsync: async () => {
        throw new Error('Custom error');
      },
    } as unknown as z.ZodType;

    const result = await validateField(throwingSchema, 'value');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Validation failed');
  });
});
