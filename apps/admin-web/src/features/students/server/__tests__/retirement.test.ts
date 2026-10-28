import { changeStudentRetirement } from '../retirement';

const getUser = jest.fn();
const rpc = jest.fn();
jest.mock('@/shared/lib/supabase/server-ssr', () => ({ createClient: () => ({ auth: { getUser }, rpc }) }));
jest.mock('@/lib/sentry/capture-api-error', () => ({ captureApiError: jest.fn() }));
jest.mock('next/server', () => ({ NextResponse: { json: (body: unknown, init?: { status: number }) => ({ status: init?.status ?? 200, json: async () => body }) } }));

describe('Student retirement HTTP boundary', () => {
  beforeEach(() => { jest.clearAllMocks(); getUser.mockResolvedValue({ data: { user: { id: 'admin' } }, error: null }); rpc.mockResolvedValue({ data: {}, error: null }); });
  it('uses the authenticated atomic command and retains an idempotent success response', async () => {
    expect((await changeStudentRetirement('student', 'retire')).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('retire_student', { p_student_id: 'student' });
  });
  it('surfaces the existing service workflow that must be resolved', async () => {
    rpc.mockResolvedValue({ error: { code: 'P0001', message: 'Resolve active enrolments before deleting this Student' } });
    const response = await changeStudentRetirement('student', 'retire');
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Resolve active enrolments before deleting this Student' });
  });
  it('rejects missing authentication before the command', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await changeStudentRetirement('student', 'retire')).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('honors the command’s active AdminStaff check for restore', async () => {
    rpc.mockResolvedValue({ error: { code: '42501', message: 'Active AdminStaff access required' } });
    expect((await changeStudentRetirement('student', 'restore')).status).toBe(403);
  });
});
