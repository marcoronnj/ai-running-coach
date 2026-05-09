import { NextResponse } from 'next/server';
import { runStravaSync } from '@/lib/strava-sync';

export const maxDuration = 60;

export async function POST() {
  const result = await runStravaSync('manual');
  const { payload } = result;

  return NextResponse.json(
    {
      ok: payload.ok,
      message: payload.message,
      warning: payload.warning,
      mode: payload.mode,
      newActivities: payload.newActivities,
      latestActivityId: payload.latestActivityId,
      latestActivityName: payload.latestActivityName,
      latestReportGenerated: payload.latestReportGenerated ?? false,
      telegramSent: payload.telegramSent ?? false,
      retryReportsProcessed: payload.retryReportsProcessed ?? 0,
      reportsGenerated: payload.reportsGenerated ?? payload.processedWithReports ?? 0,
      duration: payload.duration,
    },
    { status: result.status }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      message: 'Metodo GET non consentito. Usa POST.',
      newActivities: 0,
    },
    { status: 405 }
  );
}
