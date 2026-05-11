import Link from 'next/link';
import { Activity, ArrowLeft, Brain, CheckCircle2, LogOut, Settings, Timer, UserCircle } from 'lucide-react';
import { requireAuth } from '@/lib/auth';
import { queryOne } from '@/lib/db';
import { getPublicStravaConnectionStatus } from '@/lib/strava-connection';
import { formatDateTimeIT } from '@/lib/date-utils';
import { Card, MetricTile, PageShell, SectionHeader } from '@/app/components/ui';

export const dynamic = 'force-dynamic';

interface AccountStats {
  runsCount: number;
  latestRunAt?: string;
  latestSyncAt?: string;
  latestSyncStatus?: string;
}

async function getAccountStats(): Promise<AccountStats> {
  try {
    const activityStats = await queryOne<{
      runs_count: string | number;
      latest_run_at?: string;
    }>(
      `SELECT COUNT(*) as runs_count, MAX(start_date) as latest_run_at
       FROM activities
       WHERE type IN ('Run', 'TrailRun')`
    );

    const latestSync = await queryOne<{
      status?: string;
      created_at?: string;
    }>(
      `SELECT status, created_at
       FROM sync_logs
       ORDER BY created_at DESC
       LIMIT 1`
    );

    return {
      runsCount: Number(activityStats?.runs_count ?? 0),
      latestRunAt: activityStats?.latest_run_at,
      latestSyncAt: latestSync?.created_at,
      latestSyncStatus: latestSync?.status,
    };
  } catch (error) {
    console.error('[ACCOUNT] Stats error:', error instanceof Error ? error.message : String(error));
    return { runsCount: 0 };
  }
}

function formatDate(value?: string): string {
  if (!value) return 'N/D';
  return formatDateTimeIT(value);
}

export default async function AccountPage() {
  const session = await requireAuth();
  const stats = await getAccountStats();
  const stravaStatus = await getPublicStravaConnectionStatus(session.email);

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow mb-1">ACCOUNT</p>
            <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">Profilo app</h1>
            <p className="mt-1 text-sm text-app-muted">Sessione privata e stato della tua app atleta.</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Dashboard
            </Link>
            <form action="/api/logout" method="post">
              <button className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text">
                <LogOut size={16} strokeWidth={1.8} />
                Logout
              </button>
            </form>
          </div>
        </div>

        <Card>
          <SectionHeader eyebrow="private access" title="Account corrente" icon={UserCircle} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile label="Email" value={session.email} icon={UserCircle} tone="cyan" />
            <MetricTile
              label="Strava"
              value={stravaStatus.connected ? 'Collegato' : 'Non collegato'}
              detail={stravaStatus.connected ? `Athlete ${stravaStatus.stravaAthleteId}` : 'OAuth non configurato'}
              icon={CheckCircle2}
              tone={stravaStatus.connected ? 'success' : 'warning'}
            />
            <MetricTile label="Ultima sync" value={formatDate(stats.latestSyncAt)} detail={stats.latestSyncStatus ?? 'N/D'} icon={Timer} />
            <MetricTile label="Corse importate" value={stats.runsCount} detail={`Ultima: ${formatDate(stats.latestRunAt)}`} icon={Activity} tone="lime" />
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="quick access" title="Scorciatoie" icon={Activity} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Link className="metric-card pressable flex items-center gap-3 p-4 text-sm font-semibold text-app-text" href="/">
              <Activity size={18} strokeWidth={1.8} className="text-accent-primary" />
              Dashboard
            </Link>
            <Link className="metric-card pressable flex items-center gap-3 p-4 text-sm font-semibold text-app-text" href="/coach">
              <Brain size={18} strokeWidth={1.8} className="text-accent-secondary" />
              Coach
            </Link>
            <Link className="metric-card pressable flex items-center gap-3 p-4 text-sm font-semibold text-app-text" href="/settings">
              <Settings size={18} strokeWidth={1.8} className="text-app-muted" />
              Settings
            </Link>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
