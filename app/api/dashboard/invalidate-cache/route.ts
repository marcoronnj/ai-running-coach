import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { invalidateHomeDashboardCache } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await verifySession();

  if (!session) {
    return NextResponse.json(
      {
        ok: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  invalidateHomeDashboardCache(session.email);
  console.log('[HOME AUTO REFRESH] invalidate cache', { user: session.email });

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
