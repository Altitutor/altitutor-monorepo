/**
 * @jest-environment jsdom
 */
import { sanitizePastedHtml } from '../sanitize-pasted-html';

describe('sanitizePastedHtml', () => {
  it('strips inline color and font-size but keeps bold and italic', () => {
    const input =
      '<p><span style="color: red; font-size: 24px"><strong>Bold</strong> and <em>italic</em></span></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('<strong>Bold</strong>');
    expect(output).toContain('<em>italic</em>');
    expect(output).not.toMatch(/style=/i);
    expect(output).not.toMatch(/color:/i);
    expect(output).not.toMatch(/font-size/i);
  });

  it('converts styled spans to semantic bold/italic marks', () => {
    const input = '<p><span style="font-weight: bold; font-style: italic">Both</span></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toMatch(/<strong><em>Both<\/em><\/strong>|<em><strong>Both<\/strong><\/em>/);
    expect(output).not.toMatch(/style=/i);
  });

  it('preserves table structure and cell spans', () => {
    const input =
      '<table><tr><td colspan="2" style="background: yellow">A</td><th rowspan="2">B</th></tr></table>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('<table>');
    expect(output).toContain('colspan="2"');
    expect(output).toContain('rowspan="2"');
    expect(output).not.toMatch(/background/i);
  });

  it('unwraps underline and highlight markup', () => {
    const input = '<p><u>under</u><mark style="background: yellow">hi</mark></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('under');
    expect(output).toContain('hi');
    expect(output).not.toMatch(/<u>|<mark/i);
  });

  it('preserves image tags and upload placeholders', () => {
    const input =
      '<p>See diagram <img src="__UPLOAD_0__" alt="chart" data-file-id="abc-123"></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('src="__UPLOAD_0__"');
    expect(output).toContain('alt="chart"');
    expect(output).toContain('data-file-id="abc-123"');
  });
});
