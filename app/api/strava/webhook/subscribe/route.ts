import { NextRequest, NextResponse } from 'next/server';
import { getAppUrl } from '@/lib/app-url';
import { isAdminOrCronAuthorized } from '@/lib/internal-api-auth';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!(await isAdminOrCronAuthorized(request))) {
    return NextResponse.json({ ok: false, error: 'Admin or cron access required' }, { status: 403 });
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;

  if (!clientId || !clientSecret || !verifyToken) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Missing configuration',
        required: ['STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'STRAVA_WEBHOOK_VERIFY_TOKEN'],
      },
      { status: 500 }
    );
  }

  const callbackUrl = `${getAppUrl()}/api/strava/webhook`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  });

  const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const responseText = await response.text();
  const data = parseStravaResponse(responseText);

  if (!response.ok) {
    console.error('[STRAVA WEBHOOK] subscribe failed:', { status: response.status, data });
    return NextResponse.json({ ok: false, error: 'Strava subscription failed', details: data }, { status: response.status });
  }

  return NextResponse.json({
    ok: true,
    callbackUrl,
    subscription: data,
    subscriptionId: data?.id ?? null,
  });
}

function parseStravaResponse(responseText: string): any {
  if (!responseText) return null;

  try {
    return JSON.parse(responseText);
  } catch {
    return { raw: responseText };
  }
}
