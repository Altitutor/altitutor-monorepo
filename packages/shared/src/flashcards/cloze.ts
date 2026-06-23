export type ClozePart =
  | { type: 'text'; text: string }
  | { type: 'cloze'; index: number; answer: string; hint: string | null; active: boolean };

const CLOZE_PATTERN = /\{\{c(\d+)::(.*?)(?:::([^}]*))?\}\}/g;

export function getClozeIndexes(clozeText: string): number[] {
  const indexes = new Set<number>();
  for (const match of clozeText.matchAll(CLOZE_PATTERN)) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index > 0) indexes.add(index);
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

export function hasClozeMarker(clozeText: string): boolean {
  return getClozeIndexes(clozeText).length > 0;
}

export function parseClozeParts(clozeText: string, activeClozeIndex: number): ClozePart[] {
  const parts: ClozePart[] = [];
  let lastIndex = 0;

  for (const match of clozeText.matchAll(CLOZE_PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      parts.push({ type: 'text', text: clozeText.slice(lastIndex, start) });
    }

    const index = Number(match[1]);
    parts.push({
      type: 'cloze',
      index,
      answer: match[2] ?? '',
      hint: match[3]?.trim() ? match[3] : null,
      active: index === activeClozeIndex,
    });
    lastIndex = start + match[0].length;
  }

  if (lastIndex < clozeText.length) {
    parts.push({ type: 'text', text: clozeText.slice(lastIndex) });
  }

  return parts;
}

export function renderClozeQuestionText(clozeText: string, activeClozeIndex: number): string {
  return parseClozeParts(clozeText, activeClozeIndex)
    .map((part) => {
      if (part.type === 'text') return part.text;
      if (part.active) return part.hint ? `[...] (${part.hint})` : '[...]';
      return part.answer;
    })
    .join('');
}

export function renderClozeAnswerText(clozeText: string): string {
  return parseClozeParts(clozeText, -1)
    .map((part) => (part.type === 'text' ? part.text : part.answer))
    .join('');
}
