import { NextRequest, NextResponse } from 'next/server';
import { getActivityByIdOrStravaId, processReportForActivity } from '@/lib/run-report';
import { isTelegramNotificationsEnabled } from '@/lib/telegram';
import { isRunningActivity } from '@/lib/sport-classification';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;
  const telegramEnabled = isTelegramNotificationsEnabled();
  const telegramRequested = request.nextUrl.searchParams.get('telegram') === 'true';
  const sendTelegram = telegramEnabled && telegramRequested;

  try {
    const activity = await getActivityByIdOrStravaId(id);

    if (!activity) {
      return NextResponse.json(
        { ok: false, error: 'Run not found', message: `No activity found for id ${id}` },
        { status: 404 }
      );
    }

    if (!isRunningActivity(activity)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Not a run',
          message: 'This activity contributes to coach load, but does not generate a detailed run report.',
          activityId: activity.id,
          stravaId: activity.strava_id,
          reportGenerated: false,
        },
        { status: 422 }
      );
    }

    const { report, telegramSent, notificationsSent } = await processReportForActivity(activity, {
      sendTelegram,
      reason: 'manual-regenerate',
      syncMode: 'manual',
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Report generated successfully',
        activityId: activity.id,
        stravaId: activity.strava_id,
        reportGenerated: true,
        telegramRequested,
        telegramEnabled,
        telegramSent,
        notificationsSent,
        reportTitle: report.title,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Report generation failed',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'GET method not allowed. Use POST.' },
    { status: 405 }
  );
}
