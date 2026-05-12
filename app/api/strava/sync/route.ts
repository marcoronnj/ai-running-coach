import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { getValidStravaAccessToken } from '@/lib/strava-connection';
import { runStravaSync } from '@/lib/strava-sync';

export const maxDuration = 60;

export async function POST() {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      { ok: false, message: 'Admin access required' },
      { status: 403 }
    );
  }

  try {
    const { accessToken, connection } = await getValidStravaAccessToken(session.email);
    console.log(`[STRAVA SYNC] Admin sync user=${session.email} athlete=${connection.strava_athlete_id}`);

    const result = await runStravaSync('manual', {
      accessToken,
      skipRetryMissingReports: true,
    });

    return NextResponse.json(
      {
        ...result.payload,
        stravaConnected: true,
        stravaAthleteId: connection.strava_athlete_id,
      },
      { status: result.status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[STRAVA SYNC] Error:', message);

    return NextResponse.json(
      { ok: false, message, newActivities: 0 },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, message: 'GET method not allowed. Use POST.' },
    { status: 405 }
  );
}
