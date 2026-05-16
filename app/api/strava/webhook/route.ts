import { after, NextRequest, NextResponse } from 'next/server';
import { getStravaConnectionByAthleteId } from '@/lib/strava-connection';
import { deleteSyncedStravaActivity, syncSingleStravaActivity } from '@/lib/strava-single-sync';
import { recordWebhookEvent, updateWebhookEventStatus } from '@/lib/strava-webhook-events';

export const maxDuration = 60;

type StravaWebhookPayload = {
  object_type?: string;
  aspect_type?: string;
  object_id?: number | string;
  owner_id?: number | string;
  subscription_id?: number | string;
  event_time?: number;
};

export async function GET(request: NextRequest) {
  const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN;
  const searchParams = request.nextUrl.searchParams;
  const challenge = searchParams.get('hub.challenge') ?? searchParams.get('hub_challenge');
  const requestToken = searchParams.get('hub.verify_token') ?? searchParams.get('hub_verify_token');
  const mode = searchParams.get('hub.mode') ?? searchParams.get('hub_mode');

  if (!verifyToken) {
    console.error('[STRAVA WEBHOOK] STRAVA_WEBHOOK_VERIFY_TOKEN missing');
    return NextResponse.json({ ok: false, error: 'Webhook verify token not configured' }, { status: 500 });
  }

  if (mode !== 'subscribe' || !challenge || requestToken !== verifyToken) {
    console.warn('[STRAVA WEBHOOK] subscription verification rejected', { mode, hasChallenge: Boolean(challenge) });
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ 'hub.challenge': challenge });
}

export async function POST(request: NextRequest) {
  let payload: StravaWebhookPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const objectType = String(payload.object_type ?? '');
  const aspectType = String(payload.aspect_type ?? '');
  const objectId = String(payload.object_id ?? '');
  const ownerId = String(payload.owner_id ?? '');

  console.log('[STRAVA WEBHOOK] received', {
    object_type: objectType,
    aspect_type: aspectType,
    object_id: objectId,
    owner_id: ownerId,
  });

  if (!objectType || !aspectType || !objectId || !ownerId) {
    return NextResponse.json({ ok: false, error: 'Missing webhook fields' }, { status: 400 });
  }

  const eventId = await recordWebhookEvent({ objectType, aspectType, objectId, ownerId });

  after(async () => {
    await processStravaWebhookEvent({ objectType, aspectType, objectId, ownerId, eventId });
  });

  return NextResponse.json({ ok: true, received: true });
}

async function processStravaWebhookEvent(input: {
  objectType: string;
  aspectType: string;
  objectId: string;
  ownerId: string;
  eventId: number | null;
}): Promise<void> {
  await updateWebhookEventStatus(input.eventId, 'processing');

  try {
    if (input.objectType !== 'activity') {
      console.log(`[STRAVA WEBHOOK] ignored object_type=${input.objectType} object_id=${input.objectId}`);
      await updateWebhookEventStatus(input.eventId, 'ignored', `Unsupported object_type: ${input.objectType}`);
      return;
    }

    const connection = await getStravaConnectionByAthleteId(input.ownerId);

    if (!connection) {
      console.warn(`[STRAVA WEBHOOK] ignored unknown owner_id=${input.ownerId} object_id=${input.objectId}`);
      await updateWebhookEventStatus(input.eventId, 'ignored', 'No connected athlete matches owner_id');
      return;
    }

    if (input.aspectType === 'create') {
      const result = await syncSingleStravaActivity(input.objectId, {
        userId: connection.user_id,
        source: 'webhook',
        generateReport: true,
        allowNonRun: true,
      });

      await updateWebhookEventStatus(input.eventId, result.ok ? 'processed' : 'error', result.error);
      return;
    }

    if (input.aspectType === 'update') {
      const result = await syncSingleStravaActivity(input.objectId, {
        userId: connection.user_id,
        source: 'webhook',
        generateReport: true,
        allowNonRun: true,
      });

      await updateWebhookEventStatus(input.eventId, result.ok ? 'processed' : 'error', result.error);
      return;
    }

    if (input.aspectType === 'delete') {
      const result = await deleteSyncedStravaActivity(input.objectId);
      console.log(`[STRAVA WEBHOOK] delete processed object_id=${input.objectId} deleted=${result.deleted ? 'yes' : 'no'}`);
      await updateWebhookEventStatus(input.eventId, 'processed', result.deleted ? undefined : 'Activity not found locally');
      return;
    }

    console.log(`[STRAVA WEBHOOK] ignored aspect_type=${input.aspectType} object_id=${input.objectId}`);
    await updateWebhookEventStatus(input.eventId, 'ignored', `Unsupported aspect_type: ${input.aspectType}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[STRAVA WEBHOOK] processing failed:', message);
    await updateWebhookEventStatus(input.eventId, 'error', message);
  }
}
