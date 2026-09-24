import type { Tables } from '@altitutor/shared';
import { excludeDoneEntities, isActiveEntityForSearch } from '../excludeDoneEntities';
import type { CommandPaletteEntityResult } from '../../types';

function task(status: string): CommandPaletteEntityResult {
  return {
    type: 'task',
    id: 'task-1',
    data: { id: 'task-1', title: 'T', status, due_date: null, priority: 0 } as Pick<
      Tables<'tasks'>,
      'id' | 'title' | 'status' | 'due_date' | 'priority'
    >,
  };
}

function issue(status: string): CommandPaletteEntityResult {
  return {
    type: 'issue',
    id: 'issue-1',
    data: { id: 'issue-1', name: 'I', status, due_date: null } as Pick<
      Tables<'issues'>,
      'id' | 'name' | 'status' | 'due_date'
    >,
  };
}

function project(status: string): CommandPaletteEntityResult {
  return {
    type: 'project',
    id: 'project-1',
    data: {
      id: 'project-1',
      name: 'P',
      status,
      target_date: null,
      priority: 0,
    } as Pick<Tables<'projects'>, 'id' | 'name' | 'status' | 'target_date' | 'priority'>,
  };
}

describe('isActiveEntityForSearch', () => {
  it('excludes done tasks', () => {
    expect(isActiveEntityForSearch(task('done'))).toBe(false);
    expect(isActiveEntityForSearch(task('todo'))).toBe(true);
  });

  it('excludes resolved issues', () => {
    expect(isActiveEntityForSearch(issue('resolved'))).toBe(false);
    expect(isActiveEntityForSearch(issue('open'))).toBe(true);
  });

  it('excludes completed projects', () => {
    expect(isActiveEntityForSearch(project('completed'))).toBe(false);
    expect(isActiveEntityForSearch(project('in_progress'))).toBe(true);
  });
});

describe('excludeDoneEntities', () => {
  it('filters terminal-state work items', () => {
    const results = [
      task('todo'),
      task('done'),
      issue('open'),
      issue('resolved'),
      project('planned'),
      project('completed'),
    ];

    expect(
      excludeDoneEntities(results).map((r) => {
        switch (r.type) {
          case 'task':
          case 'issue':
          case 'project':
            return `${r.type}:${r.data.status}`;
          default:
            return r.type;
        }
      }),
    ).toEqual(['task:todo', 'issue:open', 'project:planned']);
  });
});
