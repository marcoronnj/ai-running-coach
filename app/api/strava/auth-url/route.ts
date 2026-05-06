import { redirect } from 'next/navigation';

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = 'https://ai-running-coach-three.vercel.app/api/strava/callback';
  const requestedScopes = 'read,activity:read_all';

  if (!clientId) {
    throw new Error('STRAVA_CLIENT_ID non configurato in .env.local');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'force',
    scope: requestedScopes,
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

  console.log('[STRAVA OAUTH] URL OAuth generato:', stravaAuthUrl);
  console.log('[STRAVA OAUTH] Redirect URI usato:', redirectUri);
  console.log('[STRAVA OAUTH] Scopes richiesti:', requestedScopes);

  redirect(stravaAuthUrl);
}
