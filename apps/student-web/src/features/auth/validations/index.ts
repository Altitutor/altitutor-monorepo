import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const acceptInviteSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export const registrationSchema = z
  .object({
    student: z.object({
      first_name: z.string().min(1, 'First name is required'),
      last_name: z.string().min(1, 'Last name is required'),
      email: z.string().email('Invalid email address'),
      phone: z.string().min(1, 'Phone number is required'),
      school: z.string().optional(),
      curriculum: z.enum(['SACE', 'IB', 'PRESACE', 'PRIMARY']).optional(),
      year_level: z.coerce.number().int().min(0).max(13).optional(),
      subject_ids: z.array(z.string().uuid()).min(1, 'Please select at least one subject'),
    }),
    parents: z
      .array(
        z.object({
          id: z.string().optional(),
          first_name: z.string().min(1, 'First name is required'),
          last_name: z.string().min(1, 'Last name is required'),
          email: z.string().email('Invalid email address'),
          phone: z.string().min(1, 'Phone number is required'),
        })
      )
      .min(1, 'At least one parent is required'),
    availability: z
      .object({
        monday: z.boolean(),
        tuesday: z.boolean(),
        wednesday: z.boolean(),
        thursday: z.boolean(),
        friday: z.boolean(),
        saturday_am: z.boolean(),
        saturday_pm: z.boolean(),
        sunday_am: z.boolean(),
        sunday_pm: z.boolean(),
      })
      .refine((data) => Object.values(data).some((val) => val === true), {
        message: 'At least one availability day must be selected',
      }),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().optional(),
    paymentMethodVerified: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.confirmPassword === undefined || data.confirmPassword === '') {
        return true;
      }
      return data.password === data.confirmPassword;
    },
    {
      message: "Passwords don't match",
      path: ['confirmPassword'],
    }
  )
  .refine(
    (data) =>
      data.parents.some(
        (p) => p.email && p.email.trim() !== '' && p.phone && p.phone.trim() !== ''
      ),
    { message: 'At least one parent must have both email and phone', path: ['parents'] }
  )
  .refine(
    (data) => data.paymentMethodVerified === true,
    { message: 'Payment method must be verified', path: ['paymentMethodVerified'] }
  )
  .superRefine((data, ctx) => {
    if (!data.student.curriculum) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a curriculum',
        path: ['student', 'curriculum'],
      });
    }
    if (data.student.year_level === undefined || data.student.year_level === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Please select a year level',
        path: ['student', 'year_level'],
      });
    }
  });
