import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { exchangeStravaCode } from '@/lib/strava';
import { upsertStravaConnection } from '@/lib/strava-connection';

function redirectToDashboard(request: NextRequest, params: Record<string, string>): NextResponse {
  const url = new URL('/', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      { ok: false, message: 'Accesso admin richiesto' },
      { status: 403 }
    );
  }

  const code = request.nextUrl.searchParams.get('code');
  const error = request.nextUrl.searchParams.get('error');

  if (error) {
    console.warn('[STRAVA OAUTH] Callback error:', error);
    return redirectToDashboard(request, { strava: 'error' });
  }

  if (!code) {
    return redirectToDashboard(request, { strava: 'missing_code' });
  }

  try {
    const tokenData = await exchangeStravaCode(code);
    const scope = tokenData.scope || 'read,activity:read_all';

    await upsertStravaConnection({
      userId: session.email,
      stravaAthleteId: String(tokenData.athlete.id),
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      scope,
      athlete: {
        firstname: tokenData.athlete.firstname,
        lastname: tokenData.athlete.lastname,
        username: tokenData.athlete.username,
        profile: tokenData.athlete.profile,
        profileMedium: tokenData.athlete.profile_medium,
      },
    });

    console.log(
      `[STRAVA OAUTH] Connessione salvata user=${session.email} athlete=${tokenData.athlete.id} scope=${scope}`
    );

    return redirectToDashboard(request, { strava: 'connected' });
  } catch (error) {
    console.error('[STRAVA OAUTH] Callback failed:', error instanceof Error ? error.message : String(error));
    return redirectToDashboard(request, { strava: 'error' });
  }
}
