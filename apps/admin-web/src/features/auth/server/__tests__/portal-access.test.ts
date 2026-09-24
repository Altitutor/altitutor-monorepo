/** @jest-environment node */

import * as Sentry from '@sentry/nextjs';
import type { Database } from '@altitutor/shared';
import { createServerComponentClient } from '@/shared/lib/supabase/server-component';
import { loadAdminPortalAccess } from '../portal-access';

jest.mock('server-only', () => ({}));
jest.mock('react', () => ({
  ...jest.requireActual<typeof import('react')>('react'),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn() }));
jest.mock('@/shared/lib/supabase/server-component', () => ({
  createServerComponentClient: jest.fn(),
}));

type Profile = Database['public']['Views']['vtutor_profile']['Row'];

const mockCreateServerComponentClient = jest.mocked(createServerComponentClient);
const mockCaptureMessage = jest.mocked(Sentry.captureMessage);
const mockMaybeSingle = jest.fn();

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'staff-1',
    first_name: 'Ada',
    last_name: 'Admin',
    email: 'ada.admin@example.test',
    phone: null,
    role: 'ADMINSTAFF',
    status: 'ACTIVE',
    user_id: 'user-1',
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    created_at: '2026-09-05T00:00:00Z',
    updated_at: '2026-09-05T00:00:00Z',
    profile_bio: null,
    profile_image_file_id: null,
    birthday: null,
    ...overrides,
  };
}

describe('loadAdminPortalAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockCreateServerComponentClient.mockResolvedValue({
      from: () => ({
        select: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
    } as never);
  });

  it('allows active admin staff onto AdminWeb', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: profile({ role: 'ADMINSTAFF', status: 'ACTIVE' }),
      error: null,
    });

    await expect(loadAdminPortalAccess('user-1')).resolves.toMatchObject({
      status: 'allowed',
      userId: 'user-1',
      profile: expect.objectContaining({ role: 'ADMINSTAFF' }),
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('sends tutors to the tutor portal', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: profile({ role: 'TUTOR', status: 'ACTIVE' }),
      error: null,
    });

    await expect(loadAdminPortalAccess('user-1')).resolves.toEqual({
      status: 'redirect_tutor',
    });
  });

  it('denies a session with no staff profile', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(loadAdminPortalAccess('user-1')).resolves.toEqual({
      status: 'denied',
    });
  });

  it('denies a student JWT that cannot read vtutor_profile', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'permission denied for view vtutor_profile',
      },
    });

    await expect(loadAdminPortalAccess('user-1')).resolves.toEqual({
      status: 'denied',
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('treats a missing verified identity as unauthenticated', async () => {
    await expect(loadAdminPortalAccess(null)).resolves.toEqual({
      status: 'unauthenticated',
    });
    expect(mockCreateServerComponentClient).not.toHaveBeenCalled();
  });

  it('surfaces unexpected PostgREST failures as unavailable', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    });

    await expect(loadAdminPortalAccess('user-1')).resolves.toEqual({
      status: 'unavailable',
    });
    expect(mockCaptureMessage).toHaveBeenCalled();
  });
});
