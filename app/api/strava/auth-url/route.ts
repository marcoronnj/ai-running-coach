import { redirect } from 'next/navigation';

export async function GET() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.APP_URL
    ? `${process.env.APP_URL}/api/strava/callback`
    : 'http://localhost:3000/api/strava/callback';

  if (!clientId) {
    throw new Error('STRAVA_CLIENT_ID non configurato in .env.local');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'force',
    scope: 'activity:read_all',
  });

  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

  redirect(stravaAuthUrl);
}
