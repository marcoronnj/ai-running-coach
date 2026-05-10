import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
  type AuthSession,
} from '@/lib/session';

function getConfiguredCredentials(): { email: string; password: string } {
  const email = process.env.APP_LOGIN_EMAIL;
  const password = process.env.APP_LOGIN_PASSWORD;

  if (!email || !password) {
    throw new Error('Credenziali app non configurate');
  }

  return { email, password };
}

export async function login(email: string, password: string): Promise<boolean> {
  const credentials = getConfiguredCredentials();

  if (email.trim().toLowerCase() !== credentials.email.toLowerCase()) {
    return false;
  }

  if (password !== credentials.password) {
    return false;
  }

  const token = await createSessionToken(credentials.email);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/',
  });

  return true;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function verifySession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await verifySession();

  if (!session) {
    redirect('/login');
  }

  return session;
}

export function isAdminUser(user: AuthSession | null | undefined): boolean {
  if (!user) return false;

  const adminEmail = process.env.ADMIN_EMAIL || process.env.APP_LOGIN_EMAIL;
  if (!adminEmail) return false;

  return user.email.toLowerCase() === adminEmail.toLowerCase();
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await requireAuth();

  if (!isAdminUser(session)) {
    throw new Error('Accesso admin richiesto');
  }

  return session;
}
