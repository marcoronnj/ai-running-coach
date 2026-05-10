import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { disconnectStravaConnection } from '@/lib/strava-connection';

export async function POST() {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      { ok: false, message: 'Accesso admin richiesto' },
      { status: 403 }
    );
  }

  await disconnectStravaConnection(session.email);
  console.log(`[STRAVA OAUTH] Connessione rimossa user=${session.email}`);

  return NextResponse.json({ ok: true, message: 'Strava disconnesso' });
}

export async function DELETE() {
  return POST();
}
