export type ExternalVideoProvider = 'youtube' | 'vimeo';

export type ParsedExternalVideoEmbed = {
  provider: ExternalVideoProvider;
  embedUrl: string;
};

const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

function normalizeInput(rawUrl: string): string {
  return rawUrl.trim();
}

/**
 * Parse a user-provided watch/share URL into a sandbox-friendly iframe embed URL.
 * Supports YouTube (watch, shorts, youtu.be, embed) and Vimeo.
 */
export function parseExternalVideoEmbed(rawUrl: string): ParsedExternalVideoEmbed | null {
  const urlStr = normalizeInput(rawUrl);
  if (!urlStr) return null;

  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.replace(/^\//, '').split('/')[0];
    if (!id || !YOUTUBE_ID.test(id)) return null;
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
    };
  }

  if (host === 'www.youtube.com' || host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.replace(/^\/embed\//, '').split('/')[0];
      if (!id || !YOUTUBE_ID.test(id)) return null;
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      if (!v || !YOUTUBE_ID.test(v)) return null;
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${v}` };
    }
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.replace(/^\/shorts\//, '').split('/')[0];
      if (!id || !YOUTUBE_ID.test(id)) return null;
      return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
  }

  if (host === 'vimeo.com' || host === 'www.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[0];
    if (!id || !/^\d+$/.test(id)) return null;
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  if (host === 'player.vimeo.com') {
    const m = url.pathname.match(/^\/video\/(\d+)/);
    if (!m) return null;
    return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}` };
  }

  return null;
}

export function hasExternalUrl(file: { external_url?: string | null }): boolean {
  return Boolean(file.external_url && file.external_url.trim().length > 0);
}
