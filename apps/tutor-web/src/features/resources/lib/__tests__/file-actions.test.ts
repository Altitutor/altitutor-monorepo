import { canPrintToOffice, isPdfResource } from '../file-actions';

describe('isPdfResource', () => {
  it('detects PDFs from mime type or filename', () => {
    expect(isPdfResource({ mimetype: 'application/pdf', filename: 'notes.bin' })).toBe(true);
    expect(isPdfResource({ mimetype: 'application/octet-stream', filename: 'notes.PDF' })).toBe(true);
    expect(isPdfResource({ mimetype: 'image/png', filename: 'diagram.png' })).toBe(false);
  });
});

describe('canPrintToOffice', () => {
  it('allows stored PDFs that have a files.id', () => {
    expect(
      canPrintToOffice({
        fileId: 'file-1',
        mimetype: 'application/pdf',
        filename: 'notes.pdf',
        externalUrl: null,
      }),
    ).toBe(true);
  });

  it('rejects missing file ids, external links, and non-PDFs', () => {
    expect(
      canPrintToOffice({
        fileId: null,
        mimetype: 'application/pdf',
        filename: 'notes.pdf',
        externalUrl: null,
      }),
    ).toBe(false);
    expect(
      canPrintToOffice({
        fileId: 'file-1',
        mimetype: 'application/pdf',
        filename: 'notes.pdf',
        externalUrl: 'https://example.com/notes.pdf',
      }),
    ).toBe(false);
    expect(
      canPrintToOffice({
        fileId: 'file-1',
        mimetype: 'image/png',
        filename: 'diagram.png',
        externalUrl: null,
      }),
    ).toBe(false);
  });
});
