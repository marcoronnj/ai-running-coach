import { NextRequest, NextResponse } from 'next/server';
import { getActivityByIdOrStravaId, processReportForActivity } from '@/lib/run-report';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;
  const sendTelegram = request.nextUrl.searchParams.get('telegram') === 'true';

  try {
    const activity = await getActivityByIdOrStravaId(id);

    if (!activity) {
      return NextResponse.json(
        { ok: false, error: 'Corsa non trovata', message: `Nessuna attività trovata per id ${id}` },
        { status: 404 }
      );
    }

    const { report, telegramSent } = await processReportForActivity(activity, {
      sendTelegram,
      reason: 'manual-regenerate',
      syncMode: 'manual',
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Report generato con successo',
        activityId: activity.id,
        stravaId: activity.strava_id,
        reportGenerated: true,
        telegramRequested: sendTelegram,
        telegramSent,
        reportTitle: report.title,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: 'Errore durante la generazione del report',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Metodo GET non consentito. Usa POST.' },
    { status: 405 }
  );
}
