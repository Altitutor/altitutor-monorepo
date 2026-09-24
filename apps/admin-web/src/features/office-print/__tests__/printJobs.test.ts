import { terminalPrintMessage, type PrintJobRow } from '../api/printJobs';

function job(overrides: Partial<PrintJobRow>): PrintJobRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    file_id: '22222222-2222-2222-2222-222222222222',
    filename: 'notes.pdf',
    copies: 1,
    status: 'queued',
    cups_job_id: null,
    error: null,
    created_at: new Date().toISOString(),
    completed_at: null,
    ...overrides,
  };
}

describe('terminalPrintMessage', () => {
  it('warns on ambiguous', () => {
    const message = terminalPrintMessage(job({ status: 'ambiguous' }));
    expect(message.title).toMatch(/may have/i);
    expect(message.variant).toBe('destructive');
  });

  it('reports success', () => {
    const message = terminalPrintMessage(
      job({ status: 'succeeded', copies: 2, filename: 'ws.pdf' })
    );
    expect(message.title).toMatch(/sent/i);
    expect(message.description).toContain('2');
  });
});
