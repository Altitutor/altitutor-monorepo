import fs from 'node:fs';
import path from 'node:path';

describe('ViewClassModal DOM structure', () => {
  it('uses a non-paragraph SheetDescription wrapper for block content', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/features/classes/components/modal/ViewClassModal.tsx'),
      'utf8'
    );

    expect(source).toContain('<SheetDescription asChild');
  });
});
