import { query } from '@/lib/db';

export interface StravaWebhookEventInput {
  objectType: string;
  aspectType: string;
  objectId: string;
  ownerId: string;
}

export type StravaWebhookEventStatus = 'received' | 'processing' | 'processed' | 'ignored' | 'error';

let webhookEventsTableEnsured = false;

export async function ensureWebhookEventsTable(): Promise<void> {
  if (webhookEventsTableEnsured) return;

  await query(`
    CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      object_type TEXT NOT NULL,
      aspect_type TEXT NOT NULL,
      object_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      received_at TIMESTAMPTZ DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      status TEXT DEFAULT 'received',
      error TEXT
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at
    ON webhook_events(received_at DESC)
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_webhook_events_object
    ON webhook_events(object_type, object_id)
  `);

  webhookEventsTableEnsured = true;
}

export async function recordWebhookEvent(input: StravaWebhookEventInput): Promise<number | null> {
  try {
    await ensureWebhookEventsTable();
    const result = await query<{ id: number }>(
      `INSERT INTO webhook_events (object_type, aspect_type, object_id, owner_id, status)
       VALUES ($1, $2, $3, $4, 'received')
       RETURNING id`,
      [input.objectType, input.aspectType, input.objectId, input.ownerId]
    );

    return result.rows[0]?.id ?? null;
  } catch (error) {
    console.error('[STRAVA WEBHOOK] Could not record webhook event:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

export async function updateWebhookEventStatus(
  id: number | null,
  status: StravaWebhookEventStatus,
  error?: string
): Promise<void> {
  if (!id) return;

  try {
    await query(
      `UPDATE webhook_events
       SET status = $2,
           processed_at = CASE WHEN $2 IN ('processed', 'ignored', 'error') THEN NOW() ELSE processed_at END,
           error = $3
       WHERE id = $1`,
      [id, status, error ?? null]
    );
  } catch (updateError) {
    console.error('[STRAVA WEBHOOK] Could not update webhook event:', updateError instanceof Error ? updateError.message : String(updateError));
  }
}
