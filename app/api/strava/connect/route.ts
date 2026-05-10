import { NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';

const STRAVA_SCOPE = 'read,activity:read_all';

export async function GET() {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json(
      { ok: false, message: 'Accesso admin richiesto' },
      { status: 403 }
    );
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { ok: false, message: 'Configurazione Strava mancante' },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'force',
    scope: STRAVA_SCOPE,
  });

  console.log(`[STRAVA OAUTH] Connect URL generated user=${session.email} scope=${STRAVA_SCOPE}`);

  return NextResponse.redirect(`https://www.strava.com/oauth/authorize?${params.toString()}`);
}
