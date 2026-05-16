import Link from 'next/link';
import Image from 'next/image';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  Brain,
  CalendarDays,
  Check,
  ExternalLink,
  Footprints,
  Gauge,
  HeartPulse,
  Moon,
  Settings,
  TrendingUp,
  UserCircle,
} from 'lucide-react';
import { verifySession } from '@/lib/auth';
import type { DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import { formatDateLocalized, formatDaysSinceLocalized, getTodayInAppTimezone } from '@/lib/date-utils';
import { containsItalianText, getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';
import type { PublicStravaConnectionStatus } from '@/lib/strava-connection';
import ManualSyncButton from '@/app/components/ManualSyncButton';
import PullToRefresh from '@/app/components/PullToRefresh';
import { Badge, Card, IconBox, MetricTile, PageShell, SectionHeader, cn, riskTone, scoreTone } from '@/app/components/ui';
import { getDashboardDataSafe, type DashboardRun, type WeeklyTrendItem } from '@/lib/dashboard-data';
import { normalizeLanguage, t, type Language } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Helper: Formatta chilometri
 */
function formatKm(meters: number): string {
  if (!meters) return '0 km';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/**
 * Helper: Formatta durata in minuti
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 min';

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes} min`;
}

// Date utility moved to src/lib/date-utils.ts

/**
 * Helper: Ottieni label interpretativa per readiness
 */
/**
 * Helper: Ottieni label interpretativa per risk level
 */
function getRiskLabel(riskLevel: string | undefined, language: Language): string {
  if (language === 'en') {
    switch (riskLevel?.toLowerCase()) {
      case 'basso': return 'Low';
      case 'medio': return 'Medium';
      case 'alto': return 'High';
      default: return 'N/A';
    }
  }
  switch (riskLevel?.toLowerCase()) {
    case 'basso': return 'Basso';
    case 'medio': return 'Medio';
    case 'alto': return 'Alto';
    default: return 'N/A';
  }
}

function getReportStatus(run?: DashboardRun | null): 'ready' | 'waiting' {
  return hasCoachReport(run) ? 'ready' : 'waiting';
}

function ReportStatusBadge({ status, language }: { status: 'ready' | 'waiting'; language: Language }) {
  return (
    <Badge tone={status === 'ready' ? 'success' : 'warning'}>
      {status === 'ready' ? t(language, 'report.ready') : t(language, 'report.pending')}
    </Badge>
  );
}

/**
 * Helper: Ottieni label per settimana
 */
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

function AthleteAvatar({ status }: { status?: PublicStravaConnectionStatus }) {
  const athlete = status?.athlete;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ').trim();
  const image = athlete?.profileMedium || athlete?.profile;
  const initials = fullName
    ? fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
    : '';

  if (image) {
    return (
      <img
        src={image}
        alt={fullName || 'Strava athlete'}
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-xl border border-[rgba(54,252,225,0.32)] object-cover shadow-[0_0_18px_rgba(54,252,225,0.12)]"
      />
    );
  }

  if (initials) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(54,252,225,0.32)] bg-white/[0.05] text-sm font-bold text-accent-primary shadow-[0_0_18px_rgba(54,252,225,0.12)]">
        {initials}
      </div>
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-black">
      <Activity size={18} strokeWidth={2} />
    </div>
  );
}

/**
 * Helper: Calcola media settimanale recente
 */
function calculateWeeklyAverage(trend: WeeklyTrendItem[]): number {
  if (!trend || trend.length < 2) return 0;

  // Prendi le ultime 4 settimane (escludendo la corrente)
  const recentWeeks = trend.slice(1, 5);
  if (recentWeeks.length === 0) return 0;

  const totalKm = recentWeeks.reduce((sum, week) => sum + (week.total_distance / 1000), 0);
  return totalKm / recentWeeks.length;
}

/**
 * Componente Hero - Today / Coach Status
 */
function HeroSection({ lastRun, language }: { lastRun: DashboardRun | null | undefined; language: Language }) {
  const today = formatDateLocalized(getTodayInAppTimezone(), language);
  const lastRunLabel = lastRun ? formatDaysSinceLocalized(lastRun.start_date, language) : null;
  const lastRunDetails = lastRun
    ? [
        lastRun.distance_m > 0 ? formatKm(lastRun.distance_m) : null,
        lastRun.moving_time_s > 0 ? formatDuration(lastRun.moving_time_s) : null,
        lastRun.average_speed > 0 ? formatPace(lastRun.average_speed) : null,
      ].filter(Boolean)
    : [];

  return (
    <Card className="mb-5 overflow-hidden border-[rgba(215,255,63,0.16)] bg-[linear-gradient(135deg,rgba(215,255,63,0.09),rgba(54,252,225,0.045)_42%,rgba(17,17,17,0.94))]">
      <div>
        <p className="eyebrow mb-1">{t(language, 'dashboard.todayStatus')}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">
          {today}
        </h1>
        <div className="mt-1 text-sm leading-snug text-app-muted">
          {lastRunLabel ? (
            <span className="flex flex-wrap gap-x-1.5 gap-y-1">
              <span>{t(language, 'dashboard.lastRun')}: {lastRunLabel}</span>
              {lastRunDetails.map((detail) => (
                <span key={detail}>· {detail}</span>
              ))}
            </span>
          ) : (
            <span>{language === 'en' ? 'Dashboard updating' : 'Dashboard in aggiornamento'}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

/**
 * Componente Coach Decision Card - Nuova card principale del coach
 */
function CoachDecisionCard({ state, language }: { state: DynamicAthleteState; language: Language }) {
  return (
    <Card>
      <SectionHeader
        eyebrow={t(language, 'dashboard.coachLive')}
        title={t(language, 'dashboard.currentState')}
        icon={state.hasAnyActivityToday ? Check : Brain}
        action={<Badge tone="cyan">{state.recoveryStatus}</Badge>}
        className="mb-3 items-start"
      />

      <p className="mb-4 text-[13px] leading-5 text-neutral-300">
        {state.explanation}
      </p>

      <div className="space-y-2.5">
        {state.timeline.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex gap-3 rounded-2xl border border-white/5 bg-white/[0.035] p-3">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${item.completed ? 'border-[rgba(124,255,138,0.28)] bg-[rgba(124,255,138,0.12)] text-[var(--success)]' : 'border-white/10 bg-black/20 text-app-muted'}`}>
              {item.completed ? <Check size={14} strokeWidth={2} /> : index + 1}
            </div>
            <div>
              <div className="eyebrow">{item.label}</div>
              <div className="text-sm font-semibold text-app-text">{item.title}</div>
              <div className="text-sm text-neutral-300">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Componente Metriche Atleta - Più leggibili con label interpretative
 */
function AthleteMetricsCard({ metrics, language }: { metrics: DynamicAthleteState | null | undefined; language: Language }) {
  if (!metrics) return null;

  const hasValidMetrics = metrics.readinessScore !== null || metrics.fatigueScore !== null || metrics.consistencyScore !== null;

  if (!hasValidMetrics) return null;

  return (
    <Card>
      <SectionHeader eyebrow="body battery" title={t(language, 'dashboard.athleteStatus')} icon={Gauge} />

      <div className="space-y-3">
        {metrics.readinessScore !== null && metrics.readinessLabel && (
          <MetricItem
            label="Readiness"
            value={metrics.readinessScore}
            description={metrics.readinessLabel}
            icon={Activity}
            tone="lime"
          />
        )}

        {metrics.fatigueScore !== null && metrics.fatigueLabel && (
          <MetricItem
            label="Fatigue"
            value={metrics.fatigueScore}
            description={metrics.fatigueLabel}
            icon={Moon}
            tone="warning"
          />
        )}

        {metrics.consistencyScore !== null && metrics.consistencyLabel && (
          <MetricItem
            label="Consistency"
            value={metrics.consistencyScore}
            description={metrics.consistencyLabel}
            icon={TrendingUp}
            tone="cyan"
          />
        )}

        {metrics.overloadRisk && (
          <div className="metric-card p-3.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow mb-1">
                  {t(language, 'dashboard.overloadRisk')}
                </div>
                <div className="font-medium text-app-text">
                  {getRiskLabel(metrics.overloadRisk, language)}
                </div>
                <div className="mt-1 text-xs text-app-muted">
                  {t(language, 'dashboard.updatedWithDynamicFatigue')}
                </div>
              </div>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold capitalize', riskTone(metrics.overloadRisk))}>
                {getRiskLabel(metrics.overloadRisk, language)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Componente per singola metrica
 */
function MetricItem({
  label,
  value,
  description,
  icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  description: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'lime' | 'cyan' | 'danger' | 'warning' | 'success';
}) {
  return (
    <div className="metric-card pressable p-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBox icon={icon} tone={tone} />
          <div>
            <div className="eyebrow">
              {label}
            </div>
            <div className="text-sm font-medium text-app-text">
              {description}
            </div>
          </div>
        </div>
        <div className={`text-2xl font-semibold ${scoreTone(value)}`}>
          {value}
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary"
          style={{ width: `${Math.max(0, Math.min(value, 100))}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Componente Ultima Corsa - Migliorata con bottone Strava
 */
function LastRunCard({ run, language }: { run: DashboardRun | null | undefined; language: Language }) {
  if (!run) return null;

  const reportStatus = getReportStatus(run);
  const reportExcerpt = getCoachReportExcerpt(run, 220, language);
  const runName = language === 'en' && containsItalianText(run.name) ? 'Latest run' : run.name;

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{t(language, 'dashboard.latestActivity')}</p>
          <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">{t(language, 'dashboard.latestRun')}</h2>
          <div className="mt-1 text-xs text-app-muted">
            {formatDateLocalized(run.start_date, language)}
          </div>
        </div>
        <ReportStatusBadge status={reportStatus} language={language} />
      </div>

      <div className="mb-5 space-y-4">
        <h3 className="text-lg font-semibold text-app-text">{runName}</h3>
        {reportExcerpt ? (
          <p className="text-sm leading-relaxed text-neutral-300">
            {reportExcerpt}
          </p>
        ) : (
          <p className="text-sm text-neutral-300">
            {t(language, 'dashboard.aiAnalysisPending')}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <MetricTile label={t(language, 'dashboard.distance')} value={formatKm(run.distance_m)} icon={Footprints} tone="lime" />
          <MetricTile label={t(language, 'dashboard.duration')} value={formatDuration(run.moving_time_s)} icon={CalendarDays} tone="cyan" />
          <MetricTile label={t(language, 'dashboard.avgPace')} value={run.average_speed ? formatPace(run.average_speed) : 'N/A'} icon={Gauge} />

          {run.average_heartrate && (
            <MetricTile label={t(language, 'dashboard.avgHr')} value={`${Math.round(run.average_heartrate)} bpm`} icon={HeartPulse} tone="danger" />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/runs/${run.id}`}
          className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2.5 text-sm font-bold text-black"
        >
          <span>{t(language, 'dashboard.openFullAnalysis')}</span>
          <ArrowRight size={16} strokeWidth={2} />
        </Link>

        {run.strava_id && (
          <a
            href={`https://www.strava.com/activities/${run.strava_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-app-text"
          >
            <ExternalLink size={16} strokeWidth={1.8} />
            <span>Strava</span>
          </a>
        )}
      </div>
    </Card>
  );
}

/**
 * Helper: Formatta passo medio
 */
function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

/**
 * Componente Trend Settimanale - Più interpretativo
 */
function WeeklyTrendCard({ trend, language }: { trend: WeeklyTrendItem[] | null; language: Language }) {
  if (!trend || trend.length === 0) return null;

  const weeklyAverage = calculateWeeklyAverage(trend);
  const currentWeek = trend[0]; // La settimana più recente
  const currentKm = currentWeek.total_distance / 1000;
  const maxKm = Math.max(...trend.map((week) => week.total_distance / 1000), 1);

  return (
    <Card>
      <SectionHeader eyebrow="training load" title={t(language, 'dashboard.weeklyTrend')} icon={TrendingUp} />

      <div className="metric-card mb-4 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-primary text-sm font-bold text-black">
              {currentWeek.week}
            </div>
            <div>
              <div className="font-medium text-app-text">{t(language, 'dashboard.thisWeek')}</div>
              <div className="text-xs text-app-muted">
                {currentWeek.runs} {t(language, 'dashboard.outings')}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-app-text">{formatKm(currentWeek.total_distance)}</div>
            <div className="text-xs text-app-muted">
              {getWeekLabel(currentWeek.runs, currentKm, language)}
            </div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${Math.min(100, (currentKm / maxKm) * 100)}%` }} />
        </div>

        {weeklyAverage > 0 && (
          <div className="mt-3 text-xs text-app-muted">
            {t(language, 'dashboard.recentAverage')}: {weeklyAverage.toFixed(1)} km/{language === 'en' ? 'week' : 'settimana'}
            {currentKm > weeklyAverage * 1.2 && (
              <span className="ml-2 text-[var(--success)]">+20%</span>
            )}
            {currentKm < weeklyAverage * 0.8 && (
              <span className="ml-2 text-[var(--warning)]">-20%</span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="eyebrow mb-2">
          {t(language, 'dashboard.lastWeeks')}
        </div>
        {trend.slice(1, 5).map((week, index) => {
          const weekKm = week.total_distance / 1000;
          return (
            <div key={index} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-xs font-semibold text-app-muted">
                  {week.week}
              </div>
              <div>
                <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-white/35" style={{ width: `${Math.min(100, (weekKm / maxKm) * 100)}%` }} />
                </div>
                <div className="text-xs text-app-muted">{week.runs} {t(language, 'dashboard.outings')}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-app-text">{formatKm(week.total_distance)}</div>
                <div className="text-xs text-app-muted">
                  {getWeekLabel(week.runs, weekKm, language)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * Componente Link Profilo Strava
 */
function StravaProfileLink({ status, language }: { status?: PublicStravaConnectionStatus; language: Language }) {
  const href = status?.stravaAthleteId ? `https://www.strava.com/athletes/${status.stravaAthleteId}` : 'https://www.strava.com';
  return (
    <Card className="p-3">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-app-text"
      >
        <ExternalLink size={16} strokeWidth={1.8} />
        <span>{t(language, 'dashboard.openStravaProfile')}</span>
      </a>
    </Card>
  );
}

/**
 * Componente per empty state
 */
function EmptyState({ language }: { language: Language }) {
  return (
    <Card className="p-8 text-center sm:p-10">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(215,255,63,0.2)] bg-[rgba(215,255,63,0.08)] text-accent-primary">
        <Footprints size={24} strokeWidth={1.8} />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-app-text">{t(language, 'dashboard.emptyTitle')}</h2>

      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-app-muted">
        {t(language, 'dashboard.emptyBody')}
      </p>

      <div className="text-xs text-app-muted">
        {t(language, 'dashboard.emptyFootnote')}
      </div>
    </Card>
  );
}

function DashboardRefreshingState({ language }: { language: Language }) {
  const barClasses = 'h-3 rounded-full bg-white/[0.08]';

  return (
    <div className="space-y-5 sm:space-y-6" aria-busy="true">
      <Card className="overflow-hidden border-[rgba(54,252,225,0.16)] bg-[linear-gradient(135deg,rgba(54,252,225,0.07),rgba(215,255,63,0.035)_42%,rgba(17,17,17,0.94))]">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-24 rounded-full bg-accent-secondary/20" />
          <div className="h-7 w-44 rounded-full bg-white/[0.1]" />
          <div className="h-4 w-64 max-w-full rounded-full bg-white/[0.07]" />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionHeader eyebrow={t(language, 'dashboard.coachLive')} title={t(language, 'dashboard.currentState')} icon={Brain} />
            <div className="animate-pulse space-y-3">
              <div className={`${barClasses} w-full`} />
              <div className={`${barClasses} w-10/12`} />
              <div className="mt-5 grid gap-3">
                <div className="h-20 rounded-2xl bg-white/[0.045]" />
                <div className="h-20 rounded-2xl bg-white/[0.035]" />
              </div>
            </div>
          </Card>

          <Card>
            <div className="animate-pulse space-y-4">
              <div className="h-3 w-28 rounded-full bg-accent-primary/20" />
              <div className="h-6 w-52 max-w-full rounded-full bg-white/[0.1]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-24 rounded-2xl bg-white/[0.045]" />
                <div className="h-24 rounded-2xl bg-white/[0.045]" />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <MetricsPlaceholderCard language={language} />
          <Card>
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-24 rounded-full bg-accent-secondary/20" />
              <div className="h-16 rounded-2xl bg-white/[0.045]" />
              <div className="h-16 rounded-2xl bg-white/[0.035]" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricsPlaceholderCard({ language }: { language: Language }) {
  return (
    <Card className="overflow-hidden">
      <SectionHeader eyebrow="body battery" title={t(language, 'dashboard.athleteStatus')} icon={Gauge} />
      <div className="metric-card p-3.5">
        <div className="text-sm font-medium text-app-text">
          {language === 'en' ? 'Athlete state updating' : 'Stato atleta in aggiornamento'}
        </div>
        <div className="mt-1 text-xs leading-snug text-app-muted">
          {language === 'en'
            ? 'The dashboard stays available while Veiro refreshes training signals.'
            : 'La dashboard resta disponibile mentre Veiro aggiorna i segnali di allenamento.'}
        </div>
      </div>
    </Card>
  );
}

export default async function HomePage() {
  const renderStart = Date.now();
  const sessionStart = Date.now();
  const session = await verifySession();
  console.log('[HOME PERF]', { session: `${Date.now() - sessionStart}ms` });

  const dashboardStart = Date.now();
  const dashboard = await getDashboardDataSafe(session?.email ?? null);
  console.log('[HOME PERF]', {
    dashboardLoad: `${Date.now() - dashboardStart}ms`,
    dashboardSource: dashboard.source,
    timedOut: dashboard.timedOut,
    errors: dashboard.errors.length,
  });

  const athleteSettings = dashboard.athleteSettings;
  const language = normalizeLanguage(athleteSettings?.language);
  const stravaStatus = dashboard.stravaConnection;
  const lastRun = dashboard.latestRun;
  const weeklyTrend = dashboard.trend;
  const athleteMetrics = dashboard.metrics;
  const dynamicAthleteState = dashboard.dynamicAthleteState;
  const metricsFailed = dashboard.errors.some((issue) => issue.section === 'metrics' || issue.section === 'dynamicAthleteState');
  const showTrueEmpty = dashboard.isTrueEmpty;
  const showDashboard = Boolean(lastRun) || weeklyTrend.length > 0 || dashboard.source === 'cache';
  console.log('[HOME PERF]', {
    renderTotal: `${Date.now() - renderStart}ms`,
    showDashboard,
    showTrueEmpty,
    activityPresence: dashboard.activityPresence,
    activityCount: dashboard.activityCount,
  });

  return (
    <PullToRefresh language={language}>
      <PageShell>
        {/* Header con navigazione */}
        <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AthleteAvatar status={stravaStatus} />
              <div className="min-w-0">
                <Image
                  src="/logo.svg"
                  alt="Veiro"
                  width={64}
                  height={24}
                  priority
                  className="block h-5 w-auto sm:h-6"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/coach"
              className="pressable inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-app-text sm:w-auto sm:px-3"
              title="Coach"
            >
              <Brain size={17} strokeWidth={1.8} />
              <span className="hidden sm:inline">Coach</span>
            </Link>
            <Link
              href="/settings"
              className="pressable inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-app-text"
              title="Settings"
            >
              <Settings size={17} strokeWidth={1.8} />
            </Link>
            <ManualSyncButton language={language} iconOnly />
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-app-muted sm:flex">
              <UserCircle size={18} strokeWidth={1.8} />
            </div>
          </div>
        </div>

        {showTrueEmpty ? (
          <EmptyState language={language} />
        ) : !showDashboard ? (
          <DashboardRefreshingState language={language} />
        ) : (
            <div className="space-y-5 sm:space-y-6">
            {/* Hero Section */}
            <HeroSection lastRun={lastRun} language={language} />

            {/* Layout principale */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              {/* Colonna sinistra - Coach Decision (principale) */}
              <div className="space-y-5 lg:col-span-2">
                <CoachDecisionCard state={dynamicAthleteState} language={language} />
                <LastRunCard run={lastRun} language={language} />
              </div>

              {/* Colonna destra - Metriche e trend */}
              <div className="space-y-5 lg:col-span-1">
                {metricsFailed || !athleteMetrics ? (
                  <MetricsPlaceholderCard language={language} />
                ) : (
                  <AthleteMetricsCard metrics={dynamicAthleteState} language={language} />
                )}
                {weeklyTrend.length > 0 ? (
                  <WeeklyTrendCard trend={weeklyTrend} language={language} />
                ) : null}
                <StravaProfileLink status={stravaStatus} language={language} />
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </PullToRefresh>
  );
}
