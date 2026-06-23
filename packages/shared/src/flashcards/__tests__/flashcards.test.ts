import {
  getClozeIndexes,
  parseFlashcardCsv,
  renderClozeAnswerText,
  renderClozeQuestionText,
} from '../index';

describe('flashcard cloze helpers', () => {
  it('finds unique cloze indexes in display order', () => {
    expect(getClozeIndexes('{{c2::second}} then {{c1::first}} and {{c2::again}}')).toEqual([1, 2]);
  });

  it('hides only the active cloze', () => {
    const text = '{{c1::Mitochondria}} make {{c2::ATP::energy molecule}}.';

    expect(renderClozeQuestionText(text, 2)).toBe('Mitochondria make [...] (energy molecule).');
    expect(renderClozeAnswerText(text)).toBe('Mitochondria make ATP.');
  });
});

describe('parseFlashcardCsv', () => {
  it('imports valid cloze rows and rejects non-cloze rows', () => {
    const parsed = parseFlashcardCsv(
      'text,order,extra\n"{{c1::Cell membrane}} controls movement",2,"Selective permeability"\n"No marker",1,\n',
    );

    expect(parsed.rows).toEqual([
      {
        clozeText: '{{c1::Cell membrane}} controls movement',
        extra: 'Selective permeability',
        order: 2,
      },
    ]);
    expect(parsed.rejected).toEqual([{ row: 3, reason: 'No cloze marker found' }]);
  });

  it('requires a text header', () => {
    expect(parseFlashcardCsv('front,back\nA,B').rejected).toEqual([
      { row: 1, reason: 'Missing required text column' },
    ]);
  });

  it('imports Anki TSV cloze exports with metadata headers', () => {
    const parsed = parseFlashcardCsv(
      '#separator:tab\n#html:true\n#tags column:4\n"<b>DNA</b> stands for {{c1::deoxyribonucleic acid}}."\t"<img src=""paste.jpg"">"\t\tAltitutor::12Bio\n',
    );

    expect(parsed.rows).toEqual([
      {
        clozeText: '<b>DNA</b> stands for {{c1::deoxyribonucleic acid}}.',
        extra: '<img src="paste.jpg">',
        order: null,
      },
    ]);
  });
});
