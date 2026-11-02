import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { expect, test as base } from '@playwright/test';
import type { Json } from '@altitutor/shared';
import { ownedPdfDatabase, readExportedPdf, signInForResource } from '../../../scripts/e2e/resource-pdf';

const text = (value: string): Json => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] });
const cell = (value: string) => ({ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: value }] }] });

const test = base.extend<{ exportStem: string }>({
  exportStem: async ({ baseURL }, provideStem) => {
    const database = ownedPdfDatabase('TUTOR', baseURL);
    const stemId = randomUUID();
    const questionId = randomUUID();
    const assignmentId = randomUUID();
    const { data: subject } = await database.from('subjects').select('id').eq('name', 'UCAT').single().throwOnError();
    const { data: section } = await database.from('ucat_sections').select('id').eq('name', 'Quantitative Reasoning').single().throwOnError();
    if (!subject || !section) throw new Error('Seeded UCAT reference data missing');
    const { data: assignment } = await database.from('staff_subjects').select('id')
      .eq('staff_id', '00000000-0000-0000-0000-000000000010').eq('subject_id', subject.id).maybeSingle().throwOnError();
    try {
      if (!assignment) await database.from('staff_subjects').insert({ id: assignmentId,
        staff_id: '00000000-0000-0000-0000-000000000010', subject_id: subject.id }).throwOnError();
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><rect width="100" height="50" fill="#204c63"/></svg>';
      await database.from('question_stems').insert({ id: stemId, section_id: section.id, stem_text: {
        type: 'doc', content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Read the distance table. Maths x² + 1 = 5.' }] },
          { type: 'table', content: [{ type: 'tableRow', content: [cell('Distance'), cell('12 km')] }] },
          { type: 'image', attrs: { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, alt: 'Distance diagram' } },
        ],
      } }).throwOnError();
      await database.from('ucat_questions').insert({ id: questionId, question_stem_id: stemId, index: 1,
        response_type: 'multiple_choice', answer_scheme: 'single_choice', question_text: text('Which distance is correct?'),
        answer_explanation: text('The table gives twelve kilometres.') }).throwOnError();
      await database.from('question_answer_options').insert([
        { question_id: questionId, index: 0, answer_text: text('12 km'), answer_key_value: 'correct' },
        { question_id: questionId, index: 1, answer_text: text('24 km'), answer_key_value: null },
      ]).throwOnError();
      await provideStem(stemId);
    } finally {
      await database.from('question_answer_options').delete().eq('question_id', questionId).throwOnError();
      await database.from('ucat_questions').delete().eq('id', questionId).throwOnError();
      await database.from('question_stems').delete().eq('id', stemId).throwOnError();
      if (!assignment) await database.from('staff_subjects').delete().eq('id', assignmentId).throwOnError();
    }
  },
});

test('a Tutor exports readable questions, answers, tables, text mathematics and images', async ({ page, exportStem }) => {
  await signInForResource(page, '/classes', 'john.doe@altitutor.test');
  for (const includeAnswers of [true, false]) {
    const response = await page.request.post('/api/ucat/pdf-export', { data: {
      kind: 'set', title: 'PDF regression questions', stemIds: [exportStem],
      options: { includeAnswers, repeatStems: false, avoidQuestionPageBreaks: true },
    } });
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect(response.headers()['x-altitutor-pdf-mode']).toBe('rich');
    const bytes = await response.body();
    const output = test.info().outputPath(`questions-${includeAnswers ? "answers" : "only"}.pdf`);
    await writeFile(output, bytes);
    await test.info().attach('Exported PDF', { path: output, contentType: 'application/pdf' });
    const pdf = await readExportedPdf(bytes);
    expect(pdf.pages).toBe(1);
    expect(pdf.text).toContain('PDF regression questions');
    expect(pdf.text).toContain('Which distance is correct?');
    expect(pdf.text).toContain('Distance 12 km');
    expect(pdf.text).toContain('Maths x² + 1 = 5.');
    expect(pdf.hasImage).toBe(true);
    if (includeAnswers) {
      expect(pdf.text).toMatch(/Answer: A\b/);
      expect(pdf.text).toContain('The table gives twelve kilometres.');
    } else {
      expect(pdf.text).not.toContain('Answer:');
      expect(pdf.text).not.toContain('The table gives twelve kilometres.');
    }
  }
});
