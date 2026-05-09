import { parseExternalVideoEmbed } from './embed';

describe('parseExternalVideoEmbed', () => {
  it('parses youtube watch URLs', () => {
    expect(
      parseExternalVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    ).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
  });

  it('parses youtu.be short links', () => {
    expect(parseExternalVideoEmbed('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      embedUrl: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    });
  });

  it('parses vimeo URLs', () => {
    expect(parseExternalVideoEmbed('https://vimeo.com/123456789')).toEqual({
      provider: 'vimeo',
      embedUrl: 'https://player.vimeo.com/video/123456789',
    });
  });

  it('returns null for unsupported hosts', () => {
    expect(parseExternalVideoEmbed('https://example.com/video')).toBeNull();
  });
});
