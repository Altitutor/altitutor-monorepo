import {
  loginSchema,
  forgotPasswordSchema,
  acceptInviteSchema,
  resetPasswordSchema,
  registrationSchema,
} from '../index';

describe('loginSchema', () => {
  it('should validate valid login data', () => {
    expect(() =>
      loginSchema.parse({ email: 'test@example.com', password: 'password123' })
    ).not.toThrow();
  });

  it('should reject invalid email format', () => {
    expect(() => loginSchema.parse({ email: 'invalid-email', password: 'password123' })).toThrow();
    expect(() => loginSchema.parse({ email: 'test@', password: 'password123' })).toThrow();
  });

  it('should reject password shorter than 8 characters', () => {
    expect(() =>
      loginSchema.parse({ email: 'test@example.com', password: 'short' })
    ).toThrow();
  });
});

describe('forgotPasswordSchema', () => {
  it('should validate valid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'test@example.com' })).not.toThrow();
  });

  it('should reject invalid email format', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'invalid-email' })).toThrow();
    expect(() => forgotPasswordSchema.parse({ email: '' })).toThrow();
  });
});

describe('acceptInviteSchema', () => {
  it('should validate valid invite data', () => {
    expect(() =>
      acceptInviteSchema.parse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'password123',
      })
    ).not.toThrow();
  });

  it('should reject when passwords do not match', () => {
    expect(() =>
      acceptInviteSchema.parse({
        email: 'test@example.com',
        password: 'password123',
        confirmPassword: 'different',
      })
    ).toThrow();
  });

  it('should reject password shorter than 6 characters', () => {
    expect(() =>
      acceptInviteSchema.parse({
        email: 'test@example.com',
        password: 'short',
        confirmPassword: 'short',
      })
    ).toThrow();
  });

  it('should reject invalid email', () => {
    expect(() =>
      acceptInviteSchema.parse({
        email: 'invalid',
        password: 'password123',
        confirmPassword: 'password123',
      })
    ).toThrow();
  });
});

describe('resetPasswordSchema', () => {
  it('should validate valid password with uppercase, lowercase, and number', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'Password123',
        confirmPassword: 'Password123',
      })
    ).not.toThrow();
  });

  it('should reject when passwords do not match', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'Password123',
        confirmPassword: 'Different123',
      })
    ).toThrow();
  });

  it('should reject password without uppercase', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'password123',
        confirmPassword: 'password123',
      })
    ).toThrow();
  });

  it('should reject password without lowercase', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'PASSWORD123',
        confirmPassword: 'PASSWORD123',
      })
    ).toThrow();
  });

  it('should reject password without number', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'PasswordOnly',
        confirmPassword: 'PasswordOnly',
      })
    ).toThrow();
  });

  it('should reject password shorter than 8 characters', () => {
    expect(() =>
      resetPasswordSchema.parse({
        password: 'Pass1',
        confirmPassword: 'Pass1',
      })
    ).toThrow();
  });
});

describe('registrationSchema', () => {
  const validSubjectId = '550e8400-e29b-41d4-a716-446655440000';

  const validRegistrationData = {
    student: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
      phone: '+61412345678',
      school: 'Test School',
      curriculum: 'SACE' as const,
      year_level: 10,
      subject_ids: [validSubjectId],
    },
    parents: [
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '+61412345679',
      },
    ],
    availability: {
      monday: true,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday_am: false,
      saturday_pm: false,
      sunday_am: false,
      sunday_pm: false,
    },
    password: 'password123',
    confirmPassword: 'password123',
    paymentMethodVerified: true,
    billingPolicyAgreed: true,
  };

  it('should validate valid registration data', () => {
    expect(() => registrationSchema.parse(validRegistrationData)).not.toThrow();
  });

  it('should reject missing student first name', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, first_name: '' },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid student email', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, email: 'invalid-email' },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject empty subject_ids array', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, subject_ids: [] },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid subject_id (non-UUID)', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, subject_ids: ['not-a-uuid'] },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject empty parents array', () => {
    const invalidData = {
      ...validRegistrationData,
      parents: [],
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when no availability day is selected', () => {
    const invalidData = {
      ...validRegistrationData,
      availability: {
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday_am: false,
        saturday_pm: false,
        sunday_am: false,
        sunday_pm: false,
      },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject password shorter than 6 characters', () => {
    const invalidData = {
      ...validRegistrationData,
      password: 'short',
      confirmPassword: 'short',
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when passwords do not match', () => {
    const invalidData = {
      ...validRegistrationData,
      password: 'password123',
      confirmPassword: 'different',
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when paymentMethodVerified is false', () => {
    const invalidData = {
      ...validRegistrationData,
      paymentMethodVerified: false,
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when billingPolicyAgreed is false', () => {
    const invalidData = {
      ...validRegistrationData,
      billingPolicyAgreed: false,
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when curriculum is missing', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, curriculum: undefined },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when year_level is missing', () => {
    const invalidData = {
      ...validRegistrationData,
      student: { ...validRegistrationData.student, year_level: undefined },
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when parent has empty email', () => {
    const invalidData = {
      ...validRegistrationData,
      parents: [
        {
          first_name: 'Jane',
          last_name: 'Doe',
          email: '',
          phone: '+61412345679',
        },
      ],
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });

  it('should reject when parent has empty phone', () => {
    const invalidData = {
      ...validRegistrationData,
      parents: [
        {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          phone: '',
        },
      ],
    };
    expect(() => registrationSchema.parse(invalidData)).toThrow();
  });
});
