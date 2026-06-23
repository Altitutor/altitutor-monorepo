import { hasClozeMarker } from './cloze';
import type { FlashcardImportResult, FlashcardImportRow } from './types';

function parseCsvLine(line: string): string[] {
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

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    const next = csv[i + 1];

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
      if (current.trim()) rows.push(parseCsvLine(current));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) rows.push(parseCsvLine(current));
  return rows;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '_');
}

export function parseFlashcardCsv(csv: string): FlashcardImportResult {
  const rows = parseCsvRows(csv);
  const result: FlashcardImportResult = { rows: [], rejected: [] };
  if (rows.length === 0) return result;

  const headers = rows[0].map(normalizeHeader);
  const textIndex = headers.indexOf('text');
  const titleIndex = headers.indexOf('title');
  const orderIndex = headers.indexOf('order');
  const extraIndex = headers.indexOf('extra');

  if (textIndex === -1) {
    return {
      rows: [],
      rejected: [{ row: 1, reason: 'Missing required text column' }],
    };
  }

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
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
      title: titleIndex >= 0 && row[titleIndex]?.trim() ? row[titleIndex].trim() : null,
      clozeText,
      extra: extraIndex >= 0 && row[extraIndex]?.trim() ? row[extraIndex].trim() : null,
      order: Number.isFinite(orderValue) ? orderValue : null,
    };
    result.rows.push(importRow);
  });

  return result;
}
