import { parseExternalVideoEmbed, type ResourceFile } from '@altitutor/shared';

export type ResourceMedia =
  | { kind: 'embed'; embedUrl: string; baseUrl: string }
  | { kind: 'video'; url: string }
  | { kind: 'image'; url: string }
  | { kind: 'document'; url: string }
  | { kind: 'missing' };

const VIDEO_EXTENSION = /\.(mp4|mov|m4v|webm|m3u8)(?:$|\?)/i;
const EMBED_HOSTS = [
  'youtube.com',
  'youtube-nocookie.com',
  'youtu.be',
  'googlevideo.com',
  'ytimg.com',
  'ggpht.com',
  'google.com',
  'gstatic.com',
  'googleapis.com',
  'vimeo.com',
  'vimeocdn.com',
];

export function classifyResourceMedia(
  file: Pick<ResourceFile, 'externalUrl' | 'mimetype'>,
  resolvedUrl: string | null,
): ResourceMedia {
  const source = file.externalUrl?.trim() || resolvedUrl;
  if (!source) return { kind: 'missing' };
  const embed = parseExternalVideoEmbed(source);
  if (embed) {
    return {
      kind: 'embed',
      embedUrl: playerEmbedUrl(embed.embedUrl),
      baseUrl: embed.provider === 'vimeo' ? 'https://player.vimeo.com' : 'https://www.youtube-nocookie.com',
    };
  }
  const url = resolvedUrl ?? source;
  if (file.mimetype?.startsWith('image/')) return { kind: 'image', url };
  if (file.mimetype?.startsWith('video/') || VIDEO_EXTENSION.test(url)) return { kind: 'video', url };
  return { kind: 'document', url };
}

export function playerEmbedUrl(embedUrl: string) {
  const url = new URL(embedUrl);
  url.searchParams.set('playsinline', '1');
  url.searchParams.set('rel', '0');
  url.searchParams.set('modestbranding', '1');
  url.searchParams.set('controls', '1');
  if (url.hostname.includes('youtube')) url.searchParams.set('iv_load_policy', '3');
  return url.toString();
}

export function embedPlayerDocument(embedUrl: string) {
  const src = embedUrl.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '');
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;position:absolute;inset:0}</style></head><body><iframe src="${src}" title="Video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen playsinline></iframe></body></html>`;
}

export function embedRequestAllowed(url: string) {
  if (url.startsWith('about:')) return true;
  try {
    const host = new URL(url).hostname.replace(/\.$/, '').toLowerCase();
    return EMBED_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}
