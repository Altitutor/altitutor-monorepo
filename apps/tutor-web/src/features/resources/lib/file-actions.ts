export type OfficePrintableFile = {
  fileId: string | null;
  mimetype: string | null;
  filename: string;
  externalUrl: string | null;
};

export function isPdfResource(file: Pick<OfficePrintableFile, 'mimetype' | 'filename'>): boolean {
  return (file.mimetype ?? '').toLowerCase().includes('pdf') || file.filename.toLowerCase().endsWith('.pdf');
}

export function canPrintToOffice(file: OfficePrintableFile): boolean {
  return Boolean(file.fileId) && !file.externalUrl && isPdfResource(file);
}
