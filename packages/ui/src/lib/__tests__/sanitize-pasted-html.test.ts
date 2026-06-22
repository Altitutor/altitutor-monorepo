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

  it('preserves underline and strips highlight markup', () => {
    const input =
      '<p><u>under</u><mark style="background: yellow">hi</mark><span style="text-decoration: underline">also</span></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('<u>under</u>');
    expect(output).toContain('<u>also</u>');
    expect(output).toContain('hi');
    expect(output).not.toMatch(/<mark/i);
    expect(output).not.toMatch(/background/i);
  });

  it('preserves image tags and upload placeholders', () => {
    const input =
      '<p>See diagram <img src="__UPLOAD_0__" alt="chart" data-file-id="abc-123"></p>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('src="__UPLOAD_0__"');
    expect(output).toContain('alt="chart"');
    expect(output).toContain('data-file-id="abc-123"');
  });

  it('converts table header cells to data cells without carrying background styles', () => {
    const input =
      '<table><tr><th style="background:#d9d9d9;font-weight:bold">Answer</th><th style="background:#d9d9d9;font-weight:bold">Explanation</th></tr><tr><td><p style="margin:0">1</p></td><td><p style="margin:0">B</p></td><td><p style="margin:0">Because</p></td></tr></table>';
    const output = sanitizePastedHtml(input);
    expect(output).not.toMatch(/<th\b/i);
    expect(output).toMatch(/<td><strong>Answer<\/strong><\/td>/);
    expect(output).not.toMatch(/background/i);
    expect(output).toMatch(/<td><p>1<\/p><\/td>/);
    expect(output).not.toMatch(/<strong>1<\/strong>/);
  });

  it('unwraps semantic bold tags when Word marks them as normal weight', () => {
    const input =
      '<table><tr><td><p><b style="font-weight:normal"><span>1</span></b></p></td><td><p><b style="font-weight:normal"><span>B</span></b></p></td></tr></table>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('1');
    expect(output).not.toMatch(/<strong>/i);
    expect(output).not.toMatch(/<b>/i);
  });

  it('preserves ordered and unordered lists', () => {
    const input =
      '<ul><li style="margin-left:18pt"><p>First</p></li><li><p>Second</p></li></ul><ol><li><p>One</p></li></ol>';
    const output = sanitizePastedHtml(input);
    expect(output).toContain('<ul>');
    expect(output).toContain('<ol>');
    expect(output).toContain('<li');
    expect(output).toContain('margin-left:18pt');
  });
});
