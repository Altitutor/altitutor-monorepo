/**
 * Security utilities for Twilio signature verification
 * Extracted for testability
 */

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let result = 0;
  for (let i = 0; i < aBytes.length; i++) result |= aBytes[i] ^ bBytes[i];
  return result === 0;
}

/**
 * Parse form-encoded body
 */
export function parseFormEncoded(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const obj: Record<string, string> = {};
  // @ts-ignore - URLSearchParams.entries() exists in Deno runtime
  for (const [key, value] of params.entries()) obj[key] = value;
  return obj;
}

/**
 * Verify Twilio webhook signature
 */
export async function verifyTwilioSignature(
  req: Request,
  bodyObj: Record<string, string>,
  rawBody: string,
  authToken: string | undefined,
  verifyEnabled: boolean,
  publicUrlOverride?: string
): Promise<{ ok: boolean; provided?: string; url?: string; tried?: string[] }> {
  if (!authToken || !verifyEnabled) return { ok: true };
  const signature = req.headers.get('X-Twilio-Signature') || '';

  // Build public URL (proxy-safe)
  const observed = new URL(req.url);
  const hdrProto =
    req.headers.get('x-forwarded-proto') ||
    observed.protocol.replace(':', '') ||
    'https';
  const hdrHost = req.headers.get('x-forwarded-host') || observed.host;
  let path = observed.pathname;
  if (!path.startsWith('/functions/v1/')) path = `/functions/v1${path}`;
  const url = publicUrlOverride || `${hdrProto}://${hdrHost}${path}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const candidates: string[] = [];

  // Per Twilio: canonical string = URL + each POST parameter name and value concatenated, parameters sorted by name.
  const keys1 = Object.keys(bodyObj).sort();
  const data1 = url + keys1.map((k) => `${k}${bodyObj[k] ?? ''}`).join('');
  candidates.push(data1);

  // Raw form values (no decoding) sorted by decoded key names, concatenating key+rawValue
  const rawPairs = rawBody.split('&').map((p) => p.split('='));
  const decodedForSort = rawPairs.map(([k, v]) => ({
    key: decodeURIComponent(k || ''),
    rawV: v ?? '',
  }));
  decodedForSort.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const data2 =
    url + decodedForSort.map((p) => `${p.key}${p.rawV}`).join('');
  candidates.push(data2);

  // Raw values with '+' treated as space, concatenating key+value
  const data3 =
    url +
    decodedForSort.map((p) => `${p.key}${p.rawV.replace(/\+/g, ' ')}`).join('');
  candidates.push(data3);

  for (const data of candidates) {
    const sigBuf = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(data)
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    if (timingSafeEqual(signature, expected)) {
      return { ok: true, provided: signature, url };
    }
  }
  return {
    ok: false,
    provided: signature,
    url,
    tried: candidates.map((d) => `len:${d.length}`),
  };
}
