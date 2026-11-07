import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { z } from 'zod';

const prefix = { access: 'teaching_access_v1', device: 'teaching_device_v1' } as const;
type Kind = keyof typeof prefix;
const payloadSchema = z.object({
  token: z.string().min(1), staffID: z.string().guid(), expiresAt: z.number().int().positive(),
}).strict();
type Payload = z.infer<typeof payloadSchema>;
const now = () => Math.floor(Date.now() / 1000);
const version = 'altitutor teaching device credentials v1';

function key(kind: Kind) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error('Teaching credential sealing is unavailable.');
  return Buffer.from(hkdfSync('sha256', secret, version, prefix[kind], 32));
}

function seal(kind: Kind, payload: Payload) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(kind), nonce);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [prefix[kind], nonce.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
}

function open(kind: Kind, value: string): Payload | null {
  const parts = value.split('.');
  const [type, iv, encrypted, tag] = parts;
  if (parts.length !== 4 || type !== prefix[kind] || !iv || !encrypted || !tag ||
      !/^[A-Za-z0-9_-]{16}$/.test(iv) || !/^[A-Za-z0-9_-]{22}$/.test(tag) ||
      !/^[A-Za-z0-9_-]+$/.test(encrypted) || encrypted.length > 8192) return null;
  const secret = key(kind);
  try {
    const decoder = createDecipheriv('aes-256-gcm', secret, Buffer.from(iv, 'base64url'), { authTagLength: 16 });
    decoder.setAuthTag(Buffer.from(tag, 'base64url'));
    const bytes = Buffer.concat([decoder.update(Buffer.from(encrypted, 'base64url')), decoder.final()]);
    const payload = payloadSchema.safeParse(JSON.parse(bytes.toString('utf8')));
    return payload.success && payload.data.expiresAt > now() ? payload.data : null;
  } catch { return null; }
}

export function isTeachingCredential(value: string) {
  return value.startsWith(prefix.access + '.') || value.startsWith(prefix.device + '.');
}
export function openTeachingAccess(value: string) { return open('access', value); }
export function openTeachingDevice(value: string) { return open('device', value); }

export function teachingDeviceCredentials(session: { access_token: string; refresh_token: string; expires_at?: number; expires_in: number },
                                          staffID: string, rememberedUntil = now() + 30 * 24 * 60 * 60) {
  const expiresAt = Math.min(session.expires_at ?? now() + session.expires_in, now() + 15 * 60, rememberedUntil);
  return {
    accessToken: seal('access', { token: session.access_token, staffID, expiresAt }),
    refreshToken: seal('device', { token: session.refresh_token, staffID, expiresAt: rememberedUntil }),
    expiresAt,
  };
}
