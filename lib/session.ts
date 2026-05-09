export const SESSION_COOKIE_NAME = 'arc_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export interface AuthSession {
  email: string;
  exp: number;
  iat: number;
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET non configurato');
  }
  return secret;
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(value);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getAuthSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return base64UrlEncode(signature);
}

export async function createSessionToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthSession = {
    email,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token?: string | null): Promise<AuthSession | null> {
  if (!token) return null;

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  try {
    const expectedSignature = await sign(encodedPayload);
    if (signature !== expectedSignature) return null;

    const session = JSON.parse(base64UrlDecode(encodedPayload)) as AuthSession;
    const configuredEmail = process.env.APP_LOGIN_EMAIL;
    const now = Math.floor(Date.now() / 1000);

    if (!configuredEmail || session.email !== configuredEmail) return null;
    if (!session.exp || session.exp <= now) return null;

    return session;
  } catch {
    return null;
  }
}
