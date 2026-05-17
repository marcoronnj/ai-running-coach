import webpush, { type PushSubscription } from 'web-push';
import { query } from '@/lib/db';
import type { DBActivity } from '@/lib/coach';
import { isRunningActivity } from '@/lib/sport-classification';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { normalizeLanguage, t } from '@/lib/i18n';

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

type StoredPushSubscription = {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return null;
  }

  return { publicKey, privateKey, subject };
}

function configureWebPush(): boolean {
  const vapid = getVapidConfig();
  if (!vapid) {
    console.log('[PUSH] VAPID env not configured; skipping notification');
    return false;
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return true;
}

async function disableSubscription(id: number, reason: string) {
  await query(
    `UPDATE push_subscriptions
     SET enabled = false,
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
  console.log('[PUSH] disabled subscription', { id, reason });
}

function toWebPushSubscription(subscription: StoredPushSubscription): PushSubscription {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

export async function sendPushNotification(payload: PushPayload): Promise<void> {
  if (!configureWebPush()) return;

  const result = await query<StoredPushSubscription>(
    `SELECT id, endpoint, p256dh, auth
     FROM push_subscriptions
     WHERE enabled = true
     ORDER BY updated_at DESC`
  );

  if (result.rows.length === 0) {
    console.log('[PUSH] no enabled subscriptions');
    return;
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: '/icon.png',
    badge: '/icon.png',
    url: payload.url,
  });

  await Promise.allSettled(
    result.rows.map(async (subscription) => {
      try {
        await webpush.sendNotification(toWebPushSubscription(subscription), body);
        await query(
          `UPDATE push_subscriptions
           SET last_used_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [subscription.id]
        );
        console.log('[PUSH] notification sent', { id: subscription.id });
      } catch (error) {
        const statusCode = typeof error === 'object' && error && 'statusCode' in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;

        if (statusCode === 404 || statusCode === 410) {
          await disableSubscription(subscription.id, `expired-${statusCode}`);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        console.error('[PUSH] send failed', { id: subscription.id, statusCode, message });
      }
    })
  );
}

export async function sendRunReportReadyNotification(activity: DBActivity): Promise<void> {
  if (!isRunningActivity(activity)) return;

  try {
    if (!getVapidConfig()) {
      console.log('[PUSH] VAPID env not configured; report notification not marked', { activityId: activity.id });
      return;
    }

    const subscriptions = await query<{ count: string }>(
      `SELECT COUNT(*)::TEXT AS count
       FROM push_subscriptions
       WHERE enabled = true`
    );

    if (Number(subscriptions.rows[0]?.count ?? 0) === 0) {
      console.log('[PUSH] no enabled subscriptions; report notification not marked', { activityId: activity.id });
      return;
    }

    const marked = await query<{ id: number }>(
      `UPDATE coach_reports
       SET push_sent_at = NOW()
       WHERE id = (
         SELECT id
         FROM coach_reports
         WHERE activity_id = $1
           AND push_sent_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING id`,
      [activity.id]
    );

    if (!marked.rows[0]) {
      console.log('[PUSH] report notification already sent or report missing', { activityId: activity.id });
      return;
    }

    const settings = await getAthleteSettings().catch(() => null);
    const language = normalizeLanguage(settings?.language);

    await sendPushNotification({
      title: t(language, 'notifications.newRunAnalyzed'),
      body: t(language, 'notifications.reportReadyBody'),
      url: `/runs/${activity.id}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[PUSH] run report notification failed', { activityId: activity.id, message });
  }
}
