import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { getValidStravaAccessToken } from '@/lib/strava-connection';
import { runStravaSync } from '@/lib/strava-sync';

export const maxDuration = 60;

export async function POST() {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Admin access required',
        newActivities: 0,
        latestActivityId: null,
        latestReportGenerated: false,
        telegramSent: false,
        notificationsSent: false,
        telegramEnabled: false,
        warning: null,
      },
      { status: 403 }
    );
  }

  try {
    const { accessToken } = await getValidStravaAccessToken(session.email);
    const result = await runStravaSync('manual', { accessToken });
    const { payload } = result;

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
        telegramSent: payload.telegramSent ?? false,
        notificationsSent: payload.notificationsSent ?? payload.telegramSent ?? false,
        telegramEnabled: payload.telegramEnabled ?? false,
        retryReportsProcessed: payload.retryReportsProcessed ?? 0,
        reportsGenerated: payload.reportsGenerated ?? payload.processedWithReports ?? 0,
        duration: payload.duration,
      },
      { status: result.status }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MANUAL SYNC] Error:', message);
    return NextResponse.json(
      {
        ok: false,
        message,
        newActivities: 0,
        latestActivityId: null,
        latestReportGenerated: false,
        telegramSent: false,
        notificationsSent: false,
        telegramEnabled: false,
        warning: null,
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
      telegramSent: false,
      notificationsSent: false,
      telegramEnabled: false,
      warning: null,
    },
    { status: 405 }
  );
}
