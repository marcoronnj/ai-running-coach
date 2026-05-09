import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email = typeof body.email === 'string' ? body.email : '';
    const password = typeof body.password === 'string' ? body.password : '';

    const authenticated = await login(email, password);

    if (!authenticated) {
      return NextResponse.json(
        { ok: false, message: 'Credenziali non valide' },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true, message: 'Login completato' });
  } catch (error) {
    console.error('[AUTH] Login error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { ok: false, message: 'Errore durante il login' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: 'Metodo GET non consentito. Usa POST.' },
    { status: 405 }
  );
}
