import { hasClozeMarker } from './cloze';
import type { FlashcardImportResult, FlashcardImportRow } from './types';

function parseDelimitedLine(line: string, delimiter: ',' | '\t'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseDelimitedRows(input: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '""';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      if (current.trim()) rows.push(parseDelimitedLine(current, delimiter));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) rows.push(parseDelimitedLine(current, delimiter));
  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseFlashcardCsv(csv: string): FlashcardImportResult {
  const lines = csv.split(/\r?\n/);
  const metadataLines = lines.filter((line) => line.startsWith('#'));
  const separatorLine = metadataLines.find((line) => line.toLowerCase().startsWith('#separator:'));
  const delimiter: ',' | '\t' = separatorLine?.toLowerCase().includes('tab') || csv.includes('\t') ? '\t' : ',';
  const content = lines.filter((line) => !line.startsWith('#')).join('\n');
  const rows = parseDelimitedRows(content, delimiter);
  const result: FlashcardImportResult = { rows: [], rejected: [] };
  if (rows.length === 0) return result;

  const headers = rows[0].map(normalizeHeader);
  const hasHeader = headers.includes('text') || headers.includes('cloze_text');
  const canUseAnkiShape = !hasHeader && delimiter === '\t';
  const textIndex = hasHeader ? Math.max(headers.indexOf('text'), headers.indexOf('cloze_text')) : 0;
  const orderIndex = hasHeader ? headers.indexOf('order') : -1;
  const extraIndex = hasHeader ? headers.indexOf('extra') : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const firstDataRowNumber = hasHeader ? 2 : metadataLines.length + 1;

  if (textIndex === -1 || (!hasHeader && !canUseAnkiShape)) {
    return {
      rows: [],
      rejected: [{ row: 1, reason: 'Missing required text column' }],
    };
  }

  dataRows.forEach((row, offset) => {
    const rowNumber = offset + firstDataRowNumber;
    const clozeText = row[textIndex]?.trim() ?? '';
    if (!clozeText) {
      result.rejected.push({ row: rowNumber, reason: 'Missing cloze text' });
      return;
    }
    if (!hasClozeMarker(clozeText)) {
      result.rejected.push({ row: rowNumber, reason: 'No cloze marker found' });
      return;
    }

    const orderValue = orderIndex >= 0 ? Number(row[orderIndex]) : NaN;
    const importRow: FlashcardImportRow = {
      clozeText,
      extra: extraIndex >= 0 && row[extraIndex]?.trim() ? row[extraIndex].trim() : null,
      order: Number.isFinite(orderValue) ? orderValue : null,
    };
    result.rows.push(importRow);
  });

  return result;
}
