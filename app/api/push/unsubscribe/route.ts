import { NextRequest, NextResponse } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await verifySession();

  if (!session || !isAdminUser(session)) {
    return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { endpoint?: unknown };
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';

  if (!endpoint) {
    return NextResponse.json({ ok: false, message: 'Missing endpoint' }, { status: 400 });
  }

  await query(
    `UPDATE push_subscriptions
     SET enabled = false,
         updated_at = NOW()
     WHERE endpoint = $1`,
    [endpoint]
  );

  console.log('[PUSH] subscription disabled', { endpointHash: endpoint.slice(-16) });

  return NextResponse.json({ ok: true });
}
