import { createCipheriv, createHash, randomBytes } from 'crypto';

export type CodexOAuthTokens = {
  accessToken: string;
  refreshToken?: string | null;
  idToken?: string | null;
  expiresAt?: number | null;
  accountId?: string | null;
};

type EncryptedSecret = {
  v: 1;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  ciphertext: string;
};

const DEFAULT_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const DEFAULT_ISSUER = 'https://auth.openai.com';

function encryptionKey(): Buffer {
  const raw = process.env.UCAT_CODEX_OAUTH_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('UCAT_CODEX_OAUTH_ENCRYPTION_KEY is not configured');
  }

  const maybeBase64 = Buffer.from(raw, 'base64');
  if (maybeBase64.length === 32 && maybeBase64.toString('base64').replace(/=+$/u, '') === raw.replace(/=+$/u, '')) {
    return maybeBase64;
  }

  if (Buffer.byteLength(raw, 'utf8') === 32) {
    return Buffer.from(raw, 'utf8');
  }

  return createHash('sha256').update(raw).digest();
}

export function encryptSecret(value: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function parseJwtClaims(token?: string | null): Record<string, unknown> | null {
  if (!token) return null;
  const [, payload] = token.split('.');
  if (!payload) return null;
  const decoded = decodeBase64Url(payload);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function deriveAccountId(tokens: Pick<CodexOAuthTokens, 'accessToken' | 'idToken' | 'accountId'>): string | null {
  if (tokens.accountId) return tokens.accountId;
  for (const token of [tokens.idToken, tokens.accessToken]) {
    const claims = parseJwtClaims(token);
    const auth = claims?.['https://api.openai.com/auth'];
    if (auth && typeof auth === 'object' && !Array.isArray(auth)) {
      const accountId = (auth as { chatgpt_account_id?: unknown }).chatgpt_account_id;
      if (typeof accountId === 'string' && accountId.trim()) return accountId;
    }
  }
  return null;
}

export async function startCodexDeviceFlow(): Promise<{
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  intervalSeconds: number;
}> {
  const response = await fetch(`${DEFAULT_ISSUER}/api/accounts/deviceauth/usercode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: DEFAULT_CLIENT_ID }),
  });

  if (!response.ok) {
    throw new Error(`Failed to start Codex OAuth device flow: ${await response.text()}`);
  }

  const json = (await response.json()) as {
    device_auth_id?: string;
    user_code?: string;
    interval?: number | string;
  };

  if (!json.device_auth_id || !json.user_code) {
    throw new Error('Codex OAuth device flow did not return a device code');
  }

  const intervalSeconds = typeof json.interval === 'number' ? json.interval : Number.parseInt(json.interval ?? '5', 10);
  return {
    deviceAuthId: json.device_auth_id,
    userCode: json.user_code,
    verificationUrl: `${DEFAULT_ISSUER}/codex/device`,
    intervalSeconds: Number.isFinite(intervalSeconds) ? intervalSeconds : 5,
  };
}

async function exchangeAuthorizationCode(params: {
  authorizationCode: string;
  codeVerifier: string;
}): Promise<CodexOAuthTokens> {
  const response = await fetch(`${DEFAULT_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.authorizationCode,
      redirect_uri: `${DEFAULT_ISSUER}/deviceauth/callback`,
      client_id: DEFAULT_CLIENT_ID,
      code_verifier: params.codeVerifier,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(`Codex OAuth token exchange failed: ${await response.text()}`);
  }

  const token = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    id_token?: string;
    expires_in?: number;
  };

  if (!token.access_token) {
    throw new Error('Codex OAuth token exchange did not return an access token');
  }

  const tokens: CodexOAuthTokens = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    idToken: token.id_token ?? null,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  tokens.accountId = deriveAccountId(tokens);
  return tokens;
}

export async function completeCodexDeviceFlow(params: {
  deviceAuthId: string;
  userCode: string;
}): Promise<CodexOAuthTokens | null> {
  const response = await fetch(`${DEFAULT_ISSUER}/api/accounts/deviceauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_auth_id: params.deviceAuthId,
      user_code: params.userCode,
    }),
  });

  if (response.status === 403 || response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Codex OAuth device authorization failed: ${await response.text()}`);
  }

  const grant = (await response.json()) as {
    authorization_code?: string;
    code_verifier?: string;
  };

  if (!grant.authorization_code || !grant.code_verifier) {
    throw new Error('Codex OAuth authorization grant was incomplete');
  }

  return exchangeAuthorizationCode({
    authorizationCode: grant.authorization_code,
    codeVerifier: grant.code_verifier,
  });
}
