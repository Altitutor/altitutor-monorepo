import {
  clampImageOcclusionMask,
  getClozeIndexes,
  getImageOcclusionGroupDescription,
  getImageOcclusionIndexes,
  getNextImageOcclusionIndex,
  inspectRasterImage,
  parseFlashcardCsv,
  renderClozeAnswerText,
  renderClozeQuestionText,
  validateImageOcclusionData,
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

describe('image occlusion helpers', () => {
  const data = {
    version: 1 as const,
    naturalWidth: 1200,
    naturalHeight: 800,
    masks: [
      { id: 'a', clozeIndex: 2, x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      { id: 'b', clozeIndex: 1, x: 0.4, y: 0.2, width: 0.1, height: 0.1 },
      { id: 'c', clozeIndex: 2, x: 0.2, y: 0.6, width: 0.15, height: 0.1 },
    ],
    groupDescriptions: { '2': 'The paired structures' },
  };

  it('creates one review index per distinct cloze number', () => {
    expect(getImageOcclusionIndexes(data)).toEqual([1, 2]);
    expect(getNextImageOcclusionIndex(data)).toBe(3);
  });

  it('reads optional group descriptions', () => {
    expect(getImageOcclusionGroupDescription(data, 2)).toBe('The paired structures');
    expect(getImageOcclusionGroupDescription(data, 1)).toBeNull();
  });

  it('validates masks and rejects out-of-bounds geometry', () => {
    expect(validateImageOcclusionData(data)).toEqual([]);
    expect(validateImageOcclusionData({ ...data, masks: [{ ...data.masks[0], x: 0.9, width: 0.2 }] }))
      .toContain('Box 1 must stay inside the image.');
  });

  it('clamps geometry inside the source image', () => {
    expect(clampImageOcclusionMask({ id: 'a', clozeIndex: 0, x: -1, y: 0.95, width: 0.2, height: 0.2 }))
      .toEqual({ id: 'a', clozeIndex: 1, x: 0, y: 0.8, width: 0.2, height: 0.2 });
  });

  it('inspects PNG dimensions from the file signature', () => {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    bytes.set([0, 0, 4, 0], 16);
    bytes.set([0, 0, 3, 0], 20);
    expect(inspectRasterImage(bytes)).toEqual({ mimetype: 'image/png', width: 1024, height: 768 });
  });
});
