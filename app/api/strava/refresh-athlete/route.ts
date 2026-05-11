import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { refreshStravaAthleteProfile } from '@/lib/strava-connection';

export async function POST() {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      { ok: false, message: 'Accesso admin richiesto' },
      { status: 403 }
    );
  }

  try {
    const athlete = await refreshStravaAthleteProfile(session.email);

    return NextResponse.json({
      ok: true,
      athleteId: String(athlete.id),
      firstname: athlete.firstname ?? null,
      lastname: athlete.lastname ?? null,
      username: athlete.username ?? null,
      profile: athlete.profile ?? null,
      profile_medium: athlete.profile_medium ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[STRAVA ATHLETE] Refresh failed:', message);

    return NextResponse.json(
      { ok: false, message },
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
