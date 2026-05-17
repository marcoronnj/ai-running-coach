import { NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { refreshDashboardDataFresh } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
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

  try {
    const dashboard = await refreshDashboardDataFresh(session.email);
    const timestamp = new Date().toISOString();

    console.log('[HOME AUTO REFRESH] fresh data loaded', {
      durationMs: Date.now() - startedAt,
      dashboardSource: dashboard.dashboardSource,
      latestRun: Boolean(dashboard.latestRun),
      activityCount: dashboard.activityCount,
    });

    return NextResponse.json({
      ok: true,
      timestamp,
      dashboardSource: dashboard.dashboardSource,
      updatedAt: dashboard.updatedAt,
      latestRunId: dashboard.latestRun?.id ?? null,
      activityCount: dashboard.activityCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error('[HOME AUTO REFRESH] fresh data failed', message);

    return NextResponse.json(
      {
        ok: false,
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
