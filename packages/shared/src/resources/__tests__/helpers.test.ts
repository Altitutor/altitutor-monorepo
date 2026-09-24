import type { ResourceFile } from '../types';
import {
  buildResourceFileTitle,
  displayResourceFilename,
  formatResourceFileLabel,
} from '../helpers';

function file(overrides: Partial<ResourceFile>): ResourceFile {
  return {
    id: 'primary-1',
    topicId: 'topic-1',
    code: '1.1N.1',
    type: 'NOTES',
    index: 1,
    filename: 'notes.pdf',
    mimetype: 'application/pdf',
    storagePath: 'path/notes.pdf',
    bucket: 'files',
    externalUrl: null,
    isSolutions: false,
    isSolutionsOfId: null,
    ...overrides,
  };
}

describe('displayResourceFilename', () => {
  it('strips the last extension', () => {
    expect(displayResourceFilename('notes.pdf')).toBe('notes');
    expect(displayResourceFilename('Notes.PDF')).toBe('Notes');
    expect(displayResourceFilename('archive.tar.gz')).toBe('archive.tar');
  });

  it('leaves names without an extension unchanged', () => {
    expect(displayResourceFilename('notes')).toBe('notes');
    expect(displayResourceFilename('.gitignore')).toBe('.gitignore');
  });
});

describe('formatResourceFileLabel', () => {
  it('joins the code with the extension-stripped filename', () => {
    expect(formatResourceFileLabel(file({}))).toBe('1.1N.1 · notes');
  });
});

describe('buildResourceFileTitle', () => {
  it('omits the type index when there is only one primary file of that type', () => {
    const notes = file({});
    const solution = file({
      id: 'solution-1',
      code: '1.1N.1S',
      filename: 'notes-solutions.pdf',
      isSolutions: true,
      isSolutionsOfId: 'primary-1',
    });

    expect(buildResourceFileTitle(notes, 'Cells', [notes, solution])).toBe('1.1N.1 Cells Notes');
    expect(buildResourceFileTitle(solution, 'Cells', [notes, solution])).toBe('1.1N.1S Cells Notes');
  });

  it('appends a type index when there are multiple primary files of that type', () => {
    const first = file({});
    const second = file({
      id: 'primary-2',
      code: '1.1N.2',
      index: 2,
      filename: 'notes-2.pdf',
    });

    expect(buildResourceFileTitle(first, 'Cells', [first, second])).toBe('1.1N.1 Cells Notes 1');
    expect(buildResourceFileTitle(second, 'Cells', [first, second])).toBe('1.1N.2 Cells Notes 2');
  });
});
