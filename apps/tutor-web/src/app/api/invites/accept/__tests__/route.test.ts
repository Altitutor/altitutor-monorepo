/** @jest-environment node */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { captureApiError } from '@/lib/sentry/capture-api-error';
import { POST } from '../route';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/sentry/capture-api-error', () => ({
  captureApiError: jest.fn(),
}));

const staffId = '10000000-0000-4000-8000-000000000001';
const subjectId = '20000000-0000-4000-8000-000000000001';
const conflictingStudentId = '30000000-0000-4000-8000-000000000001';
const phone = '+61400000001';
const createUser = jest.fn();
const storageFrom = jest.fn();
const from = jest.fn();
const profileResult = {
  error: null as null | { code: string; message: string },
};

function request() {
  const form = new FormData();
  form.set(
    'payload',
    JSON.stringify({
      token: '40000000-0000-4000-8000-000000000001',
      email: 'owned-tutor@example.test',
      password: 'OwnedFixture1!',
      first_name: 'Owned',
      last_name: 'Tutor',
      phone_number: phone,
      subject_ids: [subjectId],
      birthday: '2000-01-01',
      child_safe_agreement_number: 'OWNED-FIXTURE',
      child_safe_policy_agreed: true,
      profile_bio: 'Synthetic local onboarding fixture.',
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
        drafting: false,
      },
    }),
  );
  form.set(
    'profile_image',
    new File(['synthetic-image'], 'owned.png', { type: 'image/png' }),
  );
  return new NextRequest('http://localhost/api/invites/accept', {
    method: 'POST',
    body: form,
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  profileResult.error = null;
  const staffLookup = {
    eq: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({
      data: { id: staffId, role: 'TUTOR', user_id: null },
      error: null,
    }),
  };
  staffLookup.eq.mockReturnValue(staffLookup);
  const profileUpdate = { eq: jest.fn() };
  profileUpdate.eq
    .mockReturnValueOnce(profileUpdate)
    .mockImplementationOnce(() => Promise.resolve(profileResult));
  from.mockImplementation((table: string) => {
    if (table === 'staff')
      return {
        select: jest.fn().mockReturnValue(staffLookup),
        update: jest.fn().mockReturnValue(profileUpdate),
      };
    if (table === 'subjects')
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({
            data: [{ id: subjectId }],
            error: null,
          }),
        }),
      };
    throw new Error(`Unexpected write to ${table}`);
  });
  jest.mocked(createClient).mockReturnValue({
    from,
    auth: { admin: { createUser } },
    storage: { from: storageFrom },
  } as never);
});

it('lets an invitee correct a conflicting phone without starting account or photo creation', async () => {
  profileResult.error = {
    code: 'P0001',
    message: `Phone number ${phone} is already associated with a student (ID: ${conflictingStudentId})`,
  };

  const response = await POST(request());
  const body: unknown = await response.json();

  expect({ status: response.status, body }).toEqual({
    status: 409,
    body: {
      error:
        'This phone number is already in use. Enter a different phone number or contact Altitutor for help.',
    },
  });
  expect(createUser).not.toHaveBeenCalled();
  expect(storageFrom).not.toHaveBeenCalled();
  expect(from).not.toHaveBeenCalledWith('staff_subjects');
  expect(from).not.toHaveBeenCalledWith('files');
  expect(captureApiError).not.toHaveBeenCalled();
});

it.each(['another staff member', 'a parent'])(
  'handles a phone owned by %s without revealing the owner',
  async (owner) => {
    profileResult.error = {
      code: 'P0001',
      message: `Phone number ${phone} is already associated with ${owner} (ID: ${conflictingStudentId})`,
    };

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.text()).not.toMatch(
      new RegExp(
        `${phone.replace('+', '\\+')}|${conflictingStudentId}|${owner}`,
      ),
    );
    expect(createUser).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  },
);

it.each([
  { code: 'P0001', message: 'Unrelated trigger failure' },
  {
    code: 'XX000',
    message: `Phone number ${phone} is already associated with a student (ID: ${conflictingStudentId})`,
  },
])(
  'keeps unexpected profile failures observable and private ($code)',
  async (error) => {
    profileResult.error = error;

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to save onboarding details',
    });
    expect(captureApiError).toHaveBeenCalledWith(error, '/api/invites/accept');
    expect(createUser).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
  },
);
