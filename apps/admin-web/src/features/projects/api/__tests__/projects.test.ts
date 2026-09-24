import { getProjectFilterColumn } from '../projects';

describe('getProjectFilterColumn', () => {
  it('maps the project lead relation alias to its database foreign-key column', () => {
    expect(getProjectFilterColumn('project_lead')).toBe('project_lead_id');
  });

  it('preserves database-backed filter keys', () => {
    expect(getProjectFilterColumn('status')).toBe('status');
    expect(getProjectFilterColumn('target_date')).toBe('target_date');
  });
});
