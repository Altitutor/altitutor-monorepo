/**
 * Tests for TrialContactForm validation schema
 */

import { z } from 'zod';

// Replicate the schema from TrialContactForm.tsx for testing
const trialContactSchema = z.object({
  student_first_name: z.string().min(1, 'First name is required').max(100),
  student_last_name: z.string().min(1, 'Last name is required').max(100),
  student_email: z.string().email('Invalid email address'),
  student_phone: z.string().min(1, 'Phone number is required'),
  curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY'], {
    required_error: 'Please select a curriculum',
  }),
  year_level: z.enum(['Reception', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'], {
    required_error: 'Please select a year level',
  }),
  subject_ids: z.array(z.string().uuid()).min(1, 'Please select at least one subject'),
  skip_parent_details: z.boolean().default(false),
  parent_first_name: z.string().max(100).optional(),
  parent_last_name: z.string().max(100).optional(),
  parent_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  parent_phone: z.string().optional(),
}).superRefine((data, ctx) => {
  // If not skipping parent details, require all parent fields
  if (!data.skip_parent_details) {
    if (!data.parent_first_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent first name is required',
        path: ['parent_first_name'],
      });
    }
    if (!data.parent_last_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent last name is required',
        path: ['parent_last_name'],
      });
    }
    if (!data.parent_email) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent email is required',
        path: ['parent_email'],
      });
    }
    if (!data.parent_phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Parent phone number is required',
        path: ['parent_phone'],
      });
    }
  }
});

describe('TrialContactForm Schema', () => {
  const validData = {
    student_first_name: 'John',
    student_last_name: 'Doe',
    student_email: 'john.doe@example.com',
    student_phone: '0412345678',
    curriculum: 'SACE' as const,
    year_level: '10' as const,
    subject_ids: ['123e4567-e89b-12d3-a456-426614174000'],
    skip_parent_details: false,
    parent_first_name: 'Jane',
    parent_last_name: 'Doe',
    parent_email: 'jane.doe@example.com',
    parent_phone: '0412345679',
  };

  describe('student fields', () => {
    it('should validate valid student data', () => {
      expect(() => trialContactSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing student first name', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { student_first_name: _student_first_name, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should reject missing student email', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { student_email: _student_email, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should reject invalid student email format', () => {
      const data = { ...validData, student_email: 'invalid-email' };
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should reject empty subject_ids array', () => {
      const data = { ...validData, subject_ids: [] };
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should reject invalid curriculum', () => {
      const data = { ...validData, curriculum: 'INVALID' as unknown as 'SACE' };
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should reject invalid year level', () => {
      const data = { ...validData, year_level: '14' as unknown as '1' };
      expect(() => trialContactSchema.parse(data)).toThrow();
    });
  });

  describe('parent fields - when skip_parent_details is false', () => {
    it('should require all parent fields when skip_parent_details is false', () => {
      expect(() => trialContactSchema.parse(validData)).not.toThrow();
    });

    it('should reject missing parent first name', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { parent_first_name: _parent_first_name, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow('Parent first name is required');
    });

    it('should reject missing parent last name', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { parent_last_name: _parent_last_name, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow('Parent last name is required');
    });

    it('should reject missing parent email', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { parent_email: _parent_email, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow('Parent email is required');
    });

    it('should reject missing parent phone', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { parent_phone: _parent_phone, ...data } = validData;
      expect(() => trialContactSchema.parse(data)).toThrow('Parent phone number is required');
    });

    it('should reject invalid parent email format', () => {
      const data = { ...validData, parent_email: 'invalid-email' };
      expect(() => trialContactSchema.parse(data)).toThrow('Invalid email address');
    });
  });

  describe('parent fields - when skip_parent_details is true', () => {
    it('should allow missing parent fields when skip_parent_details is true', () => {
      const data = {
        ...validData,
        skip_parent_details: true,
        parent_first_name: undefined,
        parent_last_name: undefined,
        parent_email: undefined,
        parent_phone: undefined,
      };
      expect(() => trialContactSchema.parse(data)).not.toThrow();
    });

    it('should allow empty parent email when skip_parent_details is true', () => {
      const data = {
        ...validData,
        skip_parent_details: true,
        parent_email: '',
      };
      expect(() => trialContactSchema.parse(data)).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should default skip_parent_details to false', () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { skip_parent_details: _skip_parent_details, ...data } = validData;
      const result = trialContactSchema.parse(data);
      expect(result.skip_parent_details).toBe(false);
    });

    it('should validate UUID format for subject_ids', () => {
      const data = { ...validData, subject_ids: ['not-a-uuid'] };
      expect(() => trialContactSchema.parse(data)).toThrow();
    });

    it('should allow multiple subject_ids', () => {
      const data = {
        ...validData,
        subject_ids: [
          '123e4567-e89b-12d3-a456-426614174000',
          '223e4567-e89b-12d3-a456-426614174001',
        ],
      };
      expect(() => trialContactSchema.parse(data)).not.toThrow();
    });
  });
});
