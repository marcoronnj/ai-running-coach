import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { getValidStravaAccessToken } from '@/lib/strava-connection';
import { runStravaSync } from '@/lib/strava-sync';

export const maxDuration = 60;

export async function POST() {
  const startTime = Date.now();
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Admin access required',
        newActivities: 0,
        latestActivityId: null,
        latestReportGenerated: false,
        warning: null,
      },
      { status: 403 }
    );
  }

  try {
    const tokenStart = Date.now();
    const { accessToken, tokenRefreshed, athleteRefreshed } = await getValidStravaAccessToken(session.email);
    console.log(`[MANUAL SYNC][PERF] token refresh duration=${Date.now() - tokenStart}ms refreshed=${tokenRefreshed ? 'yes' : 'no'} athleteFallback=${athleteRefreshed ? 'yes' : 'no'}`);

    const result = await runStravaSync('manual', { accessToken });
    const { payload } = result;
    const totalDuration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    const stravaCalls = (payload.stravaCalls ?? 0) + (tokenRefreshed ? 1 : 0) + (athleteRefreshed ? 1 : 0);

    console.log(`[MANUAL SYNC][PERF] total duration=${Date.now() - startTime}ms stravaCalls=${stravaCalls}`);

    return NextResponse.json(
      {
        ok: payload.ok,
        message: payload.message ?? (payload.ok ? 'Sync completed' : 'Sync failed'),
        warning: payload.warning ?? null,
        mode: payload.mode,
        newActivities: payload.newActivities ?? 0,
        latestActivityId: payload.latestActivityId ?? null,
        latestActivityName: payload.latestActivityName ?? null,
        latestReportGenerated: payload.latestReportGenerated ?? false,
        retryReportsProcessed: payload.retryReportsProcessed ?? 0,
        reportsGenerated: payload.reportsGenerated ?? payload.processedWithReports ?? 0,
        duration: totalDuration,
        syncDuration: payload.duration,
        stravaCalls,
      },
      { status: result.status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MANUAL SYNC] Error:', message);
    console.log(`[MANUAL SYNC][PERF] total duration=${Date.now() - startTime}ms failed=yes`);
    return NextResponse.json(
      {
        ok: false,
        message,
        newActivities: 0,
        latestActivityId: null,
        latestReportGenerated: false,
        warning: null,
        duration: `${((Date.now() - startTime) / 1000).toFixed(1)}s`,
        stravaCalls: 0,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'GET method not allowed. Use POST.',
      newActivities: 0,
      latestActivityId: null,
      latestReportGenerated: false,
      warning: null,
    },
    { status: 405 }
  );
}
