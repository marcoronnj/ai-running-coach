'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Brain, CalendarDays, Footprints, Gauge, RotateCw, TrendingUp } from 'lucide-react';
import { Badge, Card, MetricTile, SectionHeader } from '@/app/components/ui';
import type { HomeDashboardData, DashboardRun, WeeklyTrendItem } from '@/lib/dashboard-data';
import type { Language } from '@/lib/i18n';

const STORAGE_KEY = 'veiro:lastDashboardSnapshot';
const LIVE_REFRESH_MAX_ATTEMPTS = 2;
const LIVE_REFRESH_STOP_MS = 4_000;
const LIVE_REFRESH_INITIAL_DELAY_MS = 550;
const LIVE_REFRESH_RETRY_DELAY_MS = 2_500;

function getDashboardSource(data: HomeDashboardData | null | undefined): HomeDashboardData['dashboardSource'] {
  if (!data) return 'fallback';
  if (data.dashboardSource) return data.dashboardSource;
  if (data.source === 'db') return 'db';
  if (data.source === 'snapshot-db' || data.source === 'cache') return 'snapshot-db';
  if (data.source === 'local-snapshot') return 'local-snapshot';
  return 'fallback';
}

function isFreshDashboard(data: HomeDashboardData | null | undefined) {
  const source = getDashboardSource(data);
  return source === 'fresh' || source === 'db';
}

function isValidSnapshot(data: HomeDashboardData | null | undefined): data is HomeDashboardData {
  if (!data) return false;
  const hasActivitySignal = Boolean(data.latestRun) || (typeof data.activityCount === 'number' && data.activityCount > 0);
  return Boolean(hasActivitySignal && data.athleteSettings && data.createdAt && data.updatedAt);
}

function formatKm(meters?: number | null): string {
  if (!meters) return '0 km';
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '0 min';
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${minutes} min`;
}

function formatPace(speedMs?: number | null): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

function formatDate(value?: string | null, language: Language = 'it'): string {
  if (!value) return language === 'en' ? 'Latest saved activity' : 'Ultima attivita salvata';
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function getWeekLabel(runs: number, distanceKm: number, language: Language): string {
  if (language === 'en') {
    if (runs === 0) return 'Rest';
    if (distanceKm < 10) return 'Light';
    if (distanceKm < 25) return 'Moderate';
    return 'Loaded';
  }
  if (runs === 0) return 'Riposo';
  if (distanceKm < 10) return 'Leggera';
  if (distanceKm < 25) return 'Moderata';
  return 'Carica';
}

function SnapshotHero({ run, language }: { run: DashboardRun | null; language: Language }) {
  return (
    <Card className="mb-5 overflow-hidden border-[rgba(215,255,63,0.16)] bg-[linear-gradient(135deg,rgba(215,255,63,0.09),rgba(54,252,225,0.045)_42%,rgba(17,17,17,0.94))]">
      <p className="eyebrow mb-1">{language === 'en' ? 'Today status' : 'Stato di oggi'}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">
        {run ? formatDate(run.start_date, language) : language === 'en' ? 'Training state' : 'Stato allenamento'}
      </h1>
      <div className="mt-1 text-sm leading-snug text-app-muted">
        {run
          ? `${run.name || (language === 'en' ? 'Latest run' : 'Ultima corsa')} - ${formatKm(run.distance_m)} - ${formatDuration(run.moving_time_s)}`
          : language === 'en' ? 'Latest available training signals.' : 'Ultimi segnali di allenamento disponibili.'}
      </div>
    </Card>
  );
}

function SnapshotRunCard({ run, language }: { run: DashboardRun | null; language: Language }) {
  if (!run) return null;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{language === 'en' ? 'Latest activity' : 'Ultima attivita'}</p>
          <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">
            {language === 'en' ? 'Last run' : 'Ultima corsa'}
          </h2>
          <div className="mt-1 text-xs text-app-muted">{formatDate(run.start_date, language)}</div>
        </div>
        <Badge tone={run.full_report || run.summary ? 'success' : 'warning'}>
          {run.full_report || run.summary ? (language === 'en' ? 'Ready' : 'Pronto') : (language === 'en' ? 'Pending' : 'In attesa')}
        </Badge>
      </div>

      <div className="mb-5 space-y-4">
        <h3 className="text-lg font-semibold text-app-text">{run.name || (language === 'en' ? 'Latest run' : 'Ultima corsa')}</h3>
        {run.summary ? <p className="text-sm leading-relaxed text-neutral-300">{run.summary}</p> : null}

        <div className="grid grid-cols-2 gap-3">
          <MetricTile label={language === 'en' ? 'Distance' : 'Distanza'} value={formatKm(run.distance_m)} icon={Footprints} tone="lime" />
          <MetricTile label={language === 'en' ? 'Duration' : 'Durata'} value={formatDuration(run.moving_time_s)} icon={CalendarDays} tone="cyan" />
          <MetricTile label={language === 'en' ? 'Avg pace' : 'Passo medio'} value={formatPace(run.average_speed)} icon={Gauge} />
          {run.average_heartrate ? (
            <MetricTile label={language === 'en' ? 'Avg HR' : 'FC media'} value={`${Math.round(run.average_heartrate)} bpm`} icon={Activity} tone="danger" />
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function SnapshotTrendCard({ trend, language }: { trend: WeeklyTrendItem[]; language: Language }) {
  if (!trend.length) return null;

  const currentWeek = trend[0];
  const currentKm = currentWeek.total_distance / 1000;
  const maxKm = Math.max(...trend.map((week) => week.total_distance / 1000), 1);

  return (
    <Card>
      <SectionHeader eyebrow="training load" title={language === 'en' ? 'Weekly trend' : 'Trend settimanale'} icon={TrendingUp} />
      <div className="metric-card mb-4 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="font-medium text-app-text">{language === 'en' ? 'This week' : 'Questa settimana'}</div>
            <div className="text-xs text-app-muted">{currentWeek.runs} {language === 'en' ? 'outings' : 'uscite'}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-app-text">{formatKm(currentWeek.total_distance)}</div>
            <div className="text-xs text-app-muted">{getWeekLabel(currentWeek.runs, currentKm, language)}</div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${Math.min(100, (currentKm / maxKm) * 100)}%` }} />
        </div>
      </div>
    </Card>
  );
}

function SnapshotCoachCard({ dashboard, language }: { dashboard: HomeDashboardData; language: Language }) {
  const state = dashboard.dynamicAthleteState;

  return (
    <Card>
      <SectionHeader
        eyebrow={language === 'en' ? 'live coach' : 'coach live'}
        title={language === 'en' ? 'Current state' : 'Stato attuale'}
        icon={Brain}
        action={state?.recoveryStatus ? <Badge tone="cyan">{state.recoveryStatus}</Badge> : null}
        className="mb-3 items-start"
      />
      <p className="text-[13px] leading-5 text-neutral-300">
        {state?.explanation || (language === 'en'
          ? 'Training guidance is based on the latest available activity.'
          : 'Le indicazioni sono basate sull ultima attivita disponibile.')}
      </p>
    </Card>
  );
}

function ClientDashboardSnapshot({ dashboard, language }: { dashboard: HomeDashboardData; language: Language }) {
  return (
    <div className="space-y-5 sm:space-y-6">
      <SnapshotHero run={dashboard.latestRun} language={language} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-5 lg:col-span-2">
          <SnapshotCoachCard dashboard={dashboard} language={language} />
          <SnapshotRunCard run={dashboard.latestRun} language={language} />
        </div>
        <div className="space-y-5 lg:col-span-1">
          <SnapshotTrendCard trend={dashboard.trend || []} language={language} />
        </div>
      </div>
    </div>
  );
}

function LiveRefreshPill({ language, isPending }: { language: Language; isPending: boolean }) {
  return (
    <div className="mb-3 flex justify-center sm:justify-start">
      <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(54,252,225,0.2)] bg-black/35 px-3 py-1.5 text-xs font-semibold text-neutral-200 shadow-[0_10px_30px_rgba(0,0,0,0.2)] backdrop-blur-md transition-opacity duration-300">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-secondary opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-primary shadow-[0_0_12px_rgba(54,252,225,0.55)]" />
        </span>
        <span>{language === 'en' ? 'Live update...' : 'Aggiornamento live...'}</span>
        {isPending ? <RotateCw size={12} strokeWidth={2} className="animate-spin text-accent-secondary" /> : null}
      </div>
    </div>
  );
}

function LiveRefreshToast({
  language,
  onRefresh,
  isPending,
}: {
  language: Language;
  onRefresh: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-50 flex justify-center px-4">
      <div className="fade-in flex max-w-[92vw] items-center gap-3 rounded-full border border-white/10 bg-black/75 px-3.5 py-2 text-xs font-medium text-neutral-200 shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-md">
        <span>{language === 'en' ? 'Live data not updated. Showing last sync.' : 'Dati live non aggiornati. Mostrando ultima sincronizzazione.'}</span>
        <button
          type="button"
          onClick={onRefresh}
          className="pressable inline-flex items-center gap-1.5 rounded-full border border-[rgba(54,252,225,0.22)] bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-app-text"
        >
          <RotateCw size={12} strokeWidth={2} className={isPending ? 'animate-spin text-accent-secondary' : 'text-accent-secondary'} />
          <span>{language === 'en' ? 'Refresh' : 'Aggiorna'}</span>
        </button>
      </div>
    </div>
  );
}

export default function DashboardSnapshotHydrator({
  dashboardData,
  language,
  fallback,
}: {
  dashboardData: HomeDashboardData;
  language: Language;
  fallback?: ReactNode;
}) {
  const router = useRouter();
  const [clientSnapshot, setClientSnapshot] = useState<HomeDashboardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showLiveRefresh, setShowLiveRefresh] = useState(false);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const serverSnapshotIsValid = isValidSnapshot(dashboardData);
  const serverDashboardIsFresh = isFreshDashboard(dashboardData);
  const isServerCached = serverSnapshotIsValid && !serverDashboardIsFresh;
  const shouldLiveRefresh = isServerCached || (!serverSnapshotIsValid && Boolean(clientSnapshot));

  function clearLiveTimers() {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    if (retryTimer.current) clearTimeout(retryTimer.current);
    if (stopTimer.current) clearTimeout(stopTimer.current);
    refreshTimer.current = null;
    retryTimer.current = null;
    stopTimer.current = null;
  }

  async function requestLiveRefresh(reason: 'initial' | 'retry' | 'manual') {
    if (reason !== 'manual' && attemptsRef.current >= LIVE_REFRESH_MAX_ATTEMPTS) return;

    attemptsRef.current += 1;

    if (reason === 'retry') {
      console.log('[HOME LIVE] second refresh fired');
    } else {
      console.log('[HOME LIVE] router.refresh fired');
    }

    try {
      await fetch(`/api/dashboard/fresh?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch (error) {
      console.warn('[HOME LIVE] fresh probe failed', error);
    }

    startTransition(() => router.refresh());
  }

  useEffect(() => {
    if (serverSnapshotIsValid) {
      try {
        const payload = {
          ...dashboardData,
          updatedAt: dashboardData.updatedAt || new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        console.log('[HOME SNAPSHOT] saved');
      } catch {
        // localStorage can be unavailable in private contexts.
      }
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) as HomeDashboardData : null;
      if (isValidSnapshot(parsed)) {
        console.log('[HOME SNAPSHOT] loaded from localStorage');
        setClientSnapshot({ ...parsed, source: 'local-snapshot', dashboardSource: 'local-snapshot' });
      } else {
        console.log('[HOME SNAPSHOT] no snapshot available');
      }
    } catch {
      console.log('[HOME SNAPSHOT] no snapshot available');
    }
  }, [dashboardData, serverSnapshotIsValid]);

  useEffect(() => {
    if (serverDashboardIsFresh) {
      console.log('[HOME LIVE] fresh data loaded');
      setShowLiveRefresh(false);
      attemptsRef.current = 0;
      clearLiveTimers();
      return;
    }

    if (!shouldLiveRefresh) {
      setShowLiveRefresh(false);
      clearLiveTimers();
      return;
    }

    setShowLiveRefresh(true);
    attemptsRef.current = 0;
    console.log('[HOME LIVE] mount refresh scheduled');
    refreshTimer.current = setTimeout(() => void requestLiveRefresh('initial'), LIVE_REFRESH_INITIAL_DELAY_MS);
    retryTimer.current = setTimeout(() => {
      if (isFreshDashboard(dashboardData)) return;
      void requestLiveRefresh('retry');
    }, LIVE_REFRESH_RETRY_DELAY_MS);
    stopTimer.current = setTimeout(() => {
      console.log('[HOME LIVE] stopped after timeout');
      setShowLiveRefresh(false);
    }, LIVE_REFRESH_STOP_MS);

    return clearLiveTimers;
  }, [dashboardData, serverDashboardIsFresh, shouldLiveRefresh]);

  if (serverSnapshotIsValid) {
    return (
      <>
        {showLiveRefresh ? <LiveRefreshPill language={language} isPending={isPending} /> : null}
      </>
    );
  }

  if (clientSnapshot) {
    return (
      <>
        {showLiveRefresh ? <LiveRefreshPill language={language} isPending={isPending} /> : null}
        {!showLiveRefresh && attemptsRef.current >= LIVE_REFRESH_MAX_ATTEMPTS ? (
          <LiveRefreshToast language={language} onRefresh={() => void requestLiveRefresh('manual')} isPending={isPending} />
        ) : null}
        <ClientDashboardSnapshot dashboard={clientSnapshot} language={language} />
      </>
    );
  }

  return <>{fallback}</>;
}
