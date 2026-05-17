import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type PushSubscriptionInput = {
  endpoint?: unknown;
  keys?: {
    p256dh?: unknown;
    auth?: unknown;
  };
};

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }

  const subscription = (await request.json()) as PushSubscriptionInput;
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint : '';
  const p256dh = typeof subscription.keys?.p256dh === 'string' ? subscription.keys.p256dh : '';
  const auth = typeof subscription.keys?.auth === 'string' ? subscription.keys.auth : '';

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, message: 'Invalid push subscription' }, { status: 400 });
  }

  const userAgent = request.headers.get('user-agent');

  await query(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, true, NOW(), NOW())
     ON CONFLICT (endpoint)
     DO UPDATE SET
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       enabled = true,
       updated_at = NOW()`,
    [endpoint, p256dh, auth, userAgent]
  );

  console.log('[PUSH] subscription saved', { endpointHash: endpoint.slice(-16) });

  return NextResponse.json({ ok: true });
}
