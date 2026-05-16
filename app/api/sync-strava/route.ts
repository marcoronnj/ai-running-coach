import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getValidStravaAccessToken } from '@/lib/strava-connection';
import { runStravaSync } from '@/lib/strava-sync';

/**
 * API Route: GET /api/sync-strava
 * Sincronizza le attività Strava e genera report AI.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const secretParam = request.nextUrl.searchParams.get('secret');

    if (!cronSecret) {
      await logSyncError('CRON_SECRET non configurato');
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing configuration',
          message: 'CRON_SECRET is not configured in .env.local',
          newActivities: 0,
        },
        { status: 500 }
      );
    }

    if (!secretParam || secretParam !== cronSecret) {
      await logSyncError('Secret non valido fornito nella richiesta');
      return NextResponse.json(
        {
          ok: false,
          error: 'Access denied',
          message: 'Invalid or missing secret',
          newActivities: 0,
        },
        { status: 403 }
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || process.env.APP_LOGIN_EMAIL;

    if (!adminEmail) {
      await logSyncError('ADMIN_EMAIL o APP_LOGIN_EMAIL non configurato');
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing configuration',
          message: 'ADMIN_EMAIL or APP_LOGIN_EMAIL is not configured',
          newActivities: 0,
        },
        { status: 500 }
      );
    }

    const { accessToken } = await getValidStravaAccessToken(adminEmail);
    const result = await runStravaSync('cron', { accessToken });
    return NextResponse.json(result.payload, { status: result.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[SYNC] 💥 Errore route:', errorMessage);
    await logSyncError(`Errore route sincronizzazione: ${errorMessage}`);

    return NextResponse.json(
      {
        ok: false,
        error: 'Sync failed',
        message: errorMessage,
        newActivities: 0,
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: 'POST method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    { error: 'PUT method not allowed. Use GET.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'DELETE method not allowed. Use GET.' },
    { status: 405 }
  );
}

async function logSyncError(message: string): Promise<void> {
  try {
    await query(
      'INSERT INTO sync_logs (status, message) VALUES ($1, $2)',
      ['error', message]
    );
  } catch (error) {
    console.error('[SYNC] Errore logging error:', error);
  }
}
