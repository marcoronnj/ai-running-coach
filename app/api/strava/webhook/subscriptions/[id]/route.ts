import { NextRequest, NextResponse } from 'next/server';
import { isAdminOrCronAuthorized } from '@/lib/internal-api-auth';

export const maxDuration = 30;

export async function DELETE(request: NextRequest, context: RouteContext<'/api/strava/webhook/subscriptions/[id]'>) {
  if (!(await isAdminOrCronAuthorized(request))) {
    return NextResponse.json({ ok: false, error: 'Admin or cron access required' }, { status: 403 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const { id } = await context.params;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing configuration',
        required: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET'],
      },
      { status: 500 }
    );
  }

  const url = new URL(`https://www.strava.com/api/v3/push_subscriptions/${id}`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);

  const response = await fetch(url, { method: 'DELETE' });

  if (!response.ok) {
    const responseText = await response.text();
    const data = parseStravaResponse(responseText);
    console.error('[STRAVA WEBHOOK] delete subscription failed:', { status: response.status, data });
    return NextResponse.json({ ok: false, error: 'Strava subscription delete failed', details: data }, { status: response.status });
  }

  return NextResponse.json({ ok: true, deletedSubscriptionId: id });
}

function parseStravaResponse(responseText: string): any {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}
