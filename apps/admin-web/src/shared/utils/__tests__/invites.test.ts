/**
 * Tests for invite utilities
 * Tests URL generation for different user types and environments
 */

import {
  generateSecureToken,
  buildInviteUrl,
  getInviteUrlForStudent,
  getInviteUrlForStaff,
  getBookingConfirmationUrl,
} from '../invites';

describe('generateSecureToken', () => {
  it('should generate a UUID v4 token', () => {
    const token = generateSecureToken();
    
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidRegex);
  });

  it('should generate unique tokens', () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();
    
    expect(token1).not.toBe(token2);
  });
});

describe('getInviteUrlForStudent', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStudentUrl = process.env.NEXT_PUBLIC_STUDENT_URL;

  afterEach(() => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv, NEXT_PUBLIC_STUDENT_URL: originalStudentUrl },
      writable: true,
    });
  });

  it('should generate development URL for student invite', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getInviteUrlForStudent('token-123', 'invite');
    expect(url).toBe('http://localhost:3001/invite/token-123');
  });

  it('should generate production URL for student invite', () => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_STUDENT_URL: 'https://student.altitutor.com' },
      writable: true,
    });
    
    const url = getInviteUrlForStudent('token-123', 'invite');
    expect(url).toBe('https://student.altitutor.com/invite/token-123');
  });

  it('should generate register URL for student', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getInviteUrlForStudent('token-123', 'register');
    expect(url).toBe('http://localhost:3001/register/token-123');
  });

  it('should default to invite path', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getInviteUrlForStudent('token-123');
    expect(url).toBe('http://localhost:3001/invite/token-123');
  });
});

describe('getInviteUrlForStaff', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAdminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const originalTutorUrl = process.env.NEXT_PUBLIC_TUTOR_URL;

  afterEach(() => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv, NEXT_PUBLIC_ADMIN_URL: originalAdminUrl, NEXT_PUBLIC_TUTOR_URL: originalTutorUrl },
      writable: true,
    });
  });

  it('should generate tutor URL for TUTOR role in development', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_TUTOR_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getInviteUrlForStaff('token-123', 'TUTOR');
    expect(url).toBe('http://localhost:3002/invite/token-123');
  });

  it('should generate admin URL for ADMINSTAFF role in development', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_ADMIN_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getInviteUrlForStaff('token-123', 'ADMINSTAFF');
    expect(url).toBe('http://localhost:3000/invite/token-123');
  });

  it('should generate tutor URL for TUTOR role in production', () => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_TUTOR_URL: 'https://tutor.altitutor.com' },
      writable: true,
    });
    
    const url = getInviteUrlForStaff('token-123', 'TUTOR');
    expect(url).toBe('https://tutor.altitutor.com/invite/token-123');
  });

  it('should generate admin URL for ADMINSTAFF role in production', () => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_ADMIN_URL: 'https://admin.altitutor.com' },
      writable: true,
    });
    
    const url = getInviteUrlForStaff('token-123', 'ADMINSTAFF');
    expect(url).toBe('https://admin.altitutor.com/invite/token-123');
  });
});

describe('buildInviteUrl', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalAdminUrl = process.env.NEXT_PUBLIC_ADMIN_URL;
  const originalStudentUrl = process.env.NEXT_PUBLIC_STUDENT_URL;

  afterEach(() => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv, NEXT_PUBLIC_ADMIN_URL: originalAdminUrl, NEXT_PUBLIC_STUDENT_URL: originalStudentUrl },
      writable: true,
    });
  });

  it('should build student invite URL', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = buildInviteUrl('token-123', 'student');
    expect(url).toBe('http://localhost:3001/invite/token-123');
  });

  it('should build staff invite URL (defaults to admin)', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_ADMIN_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = buildInviteUrl('token-123', 'staff');
    expect(url).toBe('http://localhost:3000/invite/token-123');
  });
});

describe('getBookingConfirmationUrl', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalStudentUrl = process.env.NEXT_PUBLIC_STUDENT_URL;

  afterEach(() => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: originalEnv, NEXT_PUBLIC_STUDENT_URL: originalStudentUrl },
      writable: true,
    });
  });

  it('should generate development booking confirmation URL', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getBookingConfirmationUrl('session-123');
    expect(url).toBe('http://localhost:3001/booking-success?sessionId=session-123');
  });

  it('should generate production booking confirmation URL', () => {
    Object.defineProperty(process, 'env', {
      value: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_STUDENT_URL: 'https://student.altitutor.com' },
      writable: true,
    });
    
    const url = getBookingConfirmationUrl('session-123');
    expect(url).toBe('https://student.altitutor.com/booking-success?sessionId=session-123');
  });

  it('should include session ID in query parameter', () => {
    const env: Record<string, string | undefined> = { ...process.env, NODE_ENV: 'development' };
    delete env.NEXT_PUBLIC_STUDENT_URL;
    Object.defineProperty(process, 'env', {
      value: env,
      writable: true,
    });
    
    const url = getBookingConfirmationUrl('session-abc-123');
    expect(url).toContain('sessionId=session-abc-123');
  });
});
