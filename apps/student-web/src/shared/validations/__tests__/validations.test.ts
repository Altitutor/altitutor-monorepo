import { baseSchemas, studentSchema, tutorSchema, classSchema, paymentSchema } from '../index';

describe('baseSchemas', () => {
  describe('name', () => {
    it('should validate valid name', () => {
      expect(() => baseSchemas.name.parse('John Doe')).not.toThrow();
    });

    it('should reject name shorter than 2 characters', () => {
      expect(() => baseSchemas.name.parse('J')).toThrow();
    });

    it('should reject name longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      expect(() => baseSchemas.name.parse(longName)).toThrow();
    });
  });

  describe('email', () => {
    it('should validate valid email', () => {
      expect(() => baseSchemas.email.parse('test@example.com')).not.toThrow();
    });

    it('should reject invalid email format', () => {
      expect(() => baseSchemas.email.parse('invalid-email')).toThrow();
      expect(() => baseSchemas.email.parse('test@')).toThrow();
      expect(() => baseSchemas.email.parse('@example.com')).toThrow();
    });
  });

  describe('phone', () => {
    it('should validate valid phone number', () => {
      expect(() => baseSchemas.phone.parse('+61412345678')).not.toThrow();
      expect(() => baseSchemas.phone.parse('61412345678')).not.toThrow(); // Starts with 6 (1-9)
    });

    it('should reject invalid phone number', () => {
      expect(() => baseSchemas.phone.parse('0123456789')).toThrow(); // Starts with 0
      expect(() => baseSchemas.phone.parse('abc123')).toThrow(); // Invalid format (contains letters)
      expect(() => baseSchemas.phone.parse('1')).toThrow(); // Too short (needs at least 1 digit after first)
    });
  });

  describe('date', () => {
    it('should validate valid date', () => {
      expect(() => baseSchemas.date.parse(new Date())).not.toThrow();
    });

    it('should reject invalid date', () => {
      expect(() => baseSchemas.date.parse('invalid')).toThrow();
      expect(() => baseSchemas.date.parse(null)).toThrow();
    });
  });

  describe('futureDate', () => {
    it('should validate future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => baseSchemas.futureDate.parse(futureDate)).not.toThrow();
    });

    it('should reject past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(() => baseSchemas.futureDate.parse(pastDate)).toThrow();
    });
  });

  describe('pastDate', () => {
    it('should validate past date', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(() => baseSchemas.pastDate.parse(pastDate)).not.toThrow();
    });

    it('should reject future date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      expect(() => baseSchemas.pastDate.parse(futureDate)).toThrow();
    });
  });

  describe('numeric', () => {
    it('should validate valid number', () => {
      expect(() => baseSchemas.numeric.parse(123)).not.toThrow();
      expect(() => baseSchemas.numeric.parse(0)).not.toThrow();
      expect(() => baseSchemas.numeric.parse(-123)).not.toThrow();
    });

    it('should reject non-numeric values', () => {
      expect(() => baseSchemas.numeric.parse('123')).toThrow();
      expect(() => baseSchemas.numeric.parse(null)).toThrow();
      expect(() => baseSchemas.numeric.parse(undefined)).toThrow();
    });
  });
});

describe('studentSchema', () => {
  const validStudentData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+61412345678',
    dateOfBirth: new Date('2010-01-01'),
    schoolName: 'Test School',
    yearLevel: 10,
    subjects: ['subject-1'],
    parentName: 'Jane Doe',
    parentEmail: 'jane.doe@example.com',
    parentPhone: '+61412345679',
  };

  it('should validate valid student data', () => {
    expect(() => studentSchema.parse(validStudentData)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    const { firstName: _firstName, ...missingFirstName } = validStudentData;
    expect(() => studentSchema.parse(missingFirstName)).toThrow();

    const { email: _email, ...missingEmail } = validStudentData;
    expect(() => studentSchema.parse(missingEmail)).toThrow();
  });

  it('should allow optional phone field', () => {
    const { phone: _phone, ...withoutPhone } = validStudentData;
    expect(() => studentSchema.parse(withoutPhone)).not.toThrow();
  });

  it('should reject empty subjects array', () => {
    const invalidData = { ...validStudentData, subjects: [] };
    expect(() => studentSchema.parse(invalidData)).toThrow();
  });

  it('should reject invalid year level', () => {
    const invalidData = { ...validStudentData, yearLevel: 0 };
    expect(() => studentSchema.parse(invalidData)).toThrow();

    const invalidData2 = { ...validStudentData, yearLevel: 13 };
    expect(() => studentSchema.parse(invalidData2)).toThrow();
  });

  it('should reject invalid email formats', () => {
    const invalidData = { ...validStudentData, email: 'invalid-email' };
    expect(() => studentSchema.parse(invalidData)).toThrow();
  });
});

describe('tutorSchema', () => {
  const validTutorData = {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
    phone: '+61412345678',
    dateOfBirth: new Date('1990-01-01'),
    subjects: ['subject-1'],
    availability: [
      {
        day: 'monday' as const,
        startTime: '09:00',
        endTime: '17:00',
      },
    ],
    qualifications: [
      {
        degree: 'Bachelor of Science',
        institution: 'University of Adelaide',
        yearCompleted: 2012,
      },
    ],
  };

  it('should validate valid tutor data', () => {
    expect(() => tutorSchema.parse(validTutorData)).not.toThrow();
  });

  it('should reject missing required fields', () => {
    const { firstName: _firstName, ...missingFirstName } = validTutorData;
    expect(() => tutorSchema.parse(missingFirstName)).toThrow();
  });

  it('should reject empty subjects array', () => {
    const invalidData = { ...validTutorData, subjects: [] };
    expect(() => tutorSchema.parse(invalidData)).toThrow();
  });

  it('should validate availability array', () => {
    const invalidData = {
      ...validTutorData,
      availability: [
        {
          day: 'invalid-day' as any,
          startTime: '09:00',
          endTime: '17:00',
        },
      ],
    };
    expect(() => tutorSchema.parse(invalidData)).toThrow();
  });
});

describe('classSchema', () => {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);

  const validClassData = {
    subject: 'subject-1',
    startDate: futureDate,
    endDate: futureDate,
    startTime: '09:00',
    endTime: '10:00',
    students: ['student-1'],
    tutor: 'tutor-1',
    location: 'Room 101',
  };

  it('should validate valid class data', () => {
    expect(() => classSchema.parse(validClassData)).not.toThrow();
  });

  it('should reject past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    const invalidData = { ...validClassData, startDate: pastDate };
    expect(() => classSchema.parse(invalidData)).toThrow();
  });

  it('should reject empty students array', () => {
    const invalidData = { ...validClassData, students: [] };
    expect(() => classSchema.parse(invalidData)).toThrow();
  });

  it('should reject missing tutor', () => {
    const invalidData = { ...validClassData, tutor: '' };
    expect(() => classSchema.parse(invalidData)).toThrow();
  });
});

describe('paymentSchema', () => {
  const validPaymentData = {
    student: 'student-1',
    amount: 100.5,
    paymentDate: new Date(),
    paymentMethod: 'card' as const,
    invoiceNumber: 'INV-001',
  };

  it('should validate valid payment data', () => {
    expect(() => paymentSchema.parse(validPaymentData)).not.toThrow();
  });

  it('should allow optional invoice number', () => {
    const { invoiceNumber: _invoiceNumber, ...withoutInvoice } = validPaymentData;
    expect(() => paymentSchema.parse(withoutInvoice)).not.toThrow();
  });

  it('should reject zero or negative amount', () => {
    const invalidData = { ...validPaymentData, amount: 0 };
    expect(() => paymentSchema.parse(invalidData)).toThrow();

    const invalidData2 = { ...validPaymentData, amount: -10 };
    expect(() => paymentSchema.parse(invalidData2)).toThrow();
  });

  it('should reject invalid payment method', () => {
    const invalidData = { ...validPaymentData, paymentMethod: 'invalid' as any };
    expect(() => paymentSchema.parse(invalidData)).toThrow();
  });
});
