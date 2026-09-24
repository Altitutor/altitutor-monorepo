import { studentsApi } from '../students';

describe('studentsApi.updateStudent', () => {
  afterEach(() => {
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it('sends the requested account class to the Student PATCH endpoint', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: 'student-1', account_class: 'internal_test' },
      }),
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
    });

    await studentsApi.updateStudent('student-1', {
      account_class: 'internal_test',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      account_class: 'internal_test',
    });
  });
});
