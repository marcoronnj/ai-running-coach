import Link from 'next/link';
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
import { query } from '@/lib/db';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { getCoachingRules } from '@/lib/coaching-rules';
import { buildDynamicAthleteState, type DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import { getLatestRunWithReport } from '@/lib/runs';
import { formatDateIT, formatDaysSince, getTodayInAppTimezone } from '@/lib/date-utils';
import { getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';
import ManualSyncButton from '@/app/components/ManualSyncButton';
import PullToRefresh from '@/app/components/PullToRefresh';
import { Badge, Card, IconBox, MetricTile, PageShell, SectionHeader, cn, riskTone, scoreTone } from '@/app/components/ui';
import { normalizeLanguage, t, type Language } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Interfacce per i dati della dashboard
 */
interface DashboardRun {
  id: string;
  strava_id: string;
  name: string;
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  average_speed: number;
  average_heartrate?: number;
  type: string;
  created_at?: string;
  title?: string;
  summary?: string;
  risk_level?: string;
  next_48h?: string;
  suggested_focus?: string;
  coach_notes?: any;
  full_report?: string;
  weekly_plan?: any;
}

interface WeeklyTrendItem {
  week: number;
  runs: number;
  total_distance: number;
}

interface AthleteMetrics {
  readinessScore?: number;
  readinessLabel?: string;
  readinessExplanation?: string;
  fatigueScore?: number;
  fatigueLabel?: string;
  fatigueExplanation?: string;
  consistencyScore?: number;
  consistencyLabel?: string;
  consistencyExplanation?: string;
  overloadRisk?: string;
  overloadExplanation?: string;
  suggestedFocus?: string;
}

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
function getRiskLabel(riskLevel?: string): string {
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

function ReportStatusBadge({ status }: { status: 'ready' | 'waiting' }) {
  const labels = {
    ready: 'Report pronto',
    waiting: 'Report in attesa',
  };

  return (
    <Badge tone={status === 'ready' ? 'success' : 'warning'}>{labels[status]}</Badge>
  );
}

/**
 * Helper: Ottieni label per settimana
 */
function getWeekLabel(runs: number, distanceKm: number): string {
  if (runs === 0) return 'Riposo';
  if (distanceKm < 10) return 'Leggera';
  if (distanceKm < 25) return 'Moderata';
  return 'Carica';
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
function HeroSection({ lastRun }: { lastRun: DashboardRun | null | undefined }) {
  const today = formatDateIT(getTodayInAppTimezone());
  const lastRunLabel = lastRun ? formatDaysSince(lastRun.start_date) : null;
  const reportStatus = getReportStatus(lastRun);

  return (
    <Card className="mb-5 overflow-hidden border-[rgba(215,255,63,0.16)] bg-[linear-gradient(135deg,rgba(215,255,63,0.09),rgba(54,252,225,0.045)_42%,rgba(17,17,17,0.94))]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Today status</p>
          <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">
            {today}
          </h1>
          <div className="mt-1 text-sm text-app-muted">
            {lastRunLabel ? (
              <span>Ultima corsa: {lastRunLabel}</span>
            ) : (
              <span>Nessuna corsa ancora sincronizzata</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 sm:min-w-52">
          <IconBox icon={Brain} tone="lime" />
          <div className="text-right">
            <div className="eyebrow">Coach</div>
            <div className="mt-1 font-medium text-app-text">
              {lastRun ? (
                <ReportStatusBadge status={reportStatus} />
              ) : (
                'In attesa dati'
              )}
            </div>
          </div>
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
      <div className="mb-5 flex items-start gap-3">
        <IconBox icon={state.hasRunToday ? Check : Brain} tone={state.hasRunToday ? 'success' : 'cyan'} />
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">
              {t(language, 'dashboard.coachLive')}
            </h2>
            <Badge tone="cyan">{state.recoveryStatus}</Badge>
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-accent-secondary">
            {t(language, 'dashboard.currentState')}
          </p>
          <p className="text-sm leading-relaxed text-neutral-300">
            {state.explanation}
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="metric-card p-3.5">
          <div className="eyebrow mb-1">
            {t(language, 'dashboard.today')}
          </div>
          <p className="text-sm text-app-text">
            {state.todayAction}
          </p>
        </div>

        <div className="metric-card p-3.5">
          <div className="eyebrow mb-1">
            {t(language, 'dashboard.tomorrow')}
          </div>
          <p className="text-sm text-app-text">
            {state.tomorrowAction}
          </p>
        </div>
      </div>

      <div className="metric-card mb-4 p-3.5">
        <div className="eyebrow mb-1">
          {t(language, 'dashboard.nextRun')}
        </div>
        <p className="text-sm text-app-text">
          {state.nextAction}
        </p>
      </div>

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
function AthleteMetricsCard({ metrics }: { metrics: DynamicAthleteState | null | undefined }) {
  if (!metrics) return null;

  const hasValidMetrics = metrics.readinessScore !== null || metrics.fatigueScore !== null || metrics.consistencyScore !== null;

  if (!hasValidMetrics) return null;

  return (
    <Card>
      <SectionHeader eyebrow="body battery" title="Stato atleta" icon={Gauge} />

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
                  Rischio Overload
                </div>
                <div className="font-medium text-app-text">
                  {getRiskLabel(metrics.overloadRisk)}
                </div>
                <div className="mt-1 text-xs text-app-muted">
                  Aggiornato con fatica dinamica e giorni dall'ultima corsa.
                </div>
              </div>
              <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold capitalize', riskTone(metrics.overloadRisk))}>
                {metrics.overloadRisk}
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
function LastRunCard({ run }: { run: DashboardRun | null | undefined }) {
  if (!run) return null;

  const reportStatus = getReportStatus(run);
  const reportExcerpt = getCoachReportExcerpt(run);

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">latest activity</p>
          <h2 className="text-base font-semibold tracking-tight text-app-text sm:text-lg">Ultima corsa</h2>
          <div className="mt-1 text-xs text-app-muted">
            {formatDateIT(run.start_date)}
          </div>
        </div>
        <ReportStatusBadge status={reportStatus} />
      </div>

      <div className="mb-5 space-y-4">
        <h3 className="text-lg font-semibold text-app-text">{run.name}</h3>
        {reportExcerpt ? (
          <p className="text-sm leading-relaxed text-neutral-300">
            {reportExcerpt}
          </p>
        ) : (
          <p className="text-sm text-neutral-300">
            Analisi AI in attesa di generazione.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Distanza" value={formatKm(run.distance_m)} icon={Footprints} tone="lime" />
          <MetricTile label="Durata" value={formatDuration(run.moving_time_s)} icon={CalendarDays} tone="cyan" />
          <MetricTile label="Passo medio" value={run.average_speed ? formatPace(run.average_speed) : 'N/A'} icon={Gauge} />

          {run.average_heartrate && (
            <MetricTile label="FC media" value={`${Math.round(run.average_heartrate)} bpm`} icon={HeartPulse} tone="danger" />
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href={`/runs/${run.id}`}
          className="pressable inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2.5 text-sm font-bold text-black"
        >
          <span>Apri analisi</span>
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
function WeeklyTrendCard({ trend }: { trend: WeeklyTrendItem[] | null }) {
  if (!trend || trend.length === 0) return null;

  const weeklyAverage = calculateWeeklyAverage(trend);
  const currentWeek = trend[0]; // La settimana più recente
  const currentKm = currentWeek.total_distance / 1000;
  const maxKm = Math.max(...trend.map((week) => week.total_distance / 1000), 1);

  return (
    <Card>
      <SectionHeader eyebrow="training load" title="Trend settimanale" icon={TrendingUp} />

      <div className="metric-card mb-4 p-3.5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-primary text-sm font-bold text-black">
              {currentWeek.week}
            </div>
            <div>
              <div className="font-medium text-app-text">Questa settimana</div>
              <div className="text-xs text-app-muted">
                {currentWeek.runs} uscite
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold text-app-text">{formatKm(currentWeek.total_distance)}</div>
            <div className="text-xs text-app-muted">
              {getWeekLabel(currentWeek.runs, currentKm)}
            </div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${Math.min(100, (currentKm / maxKm) * 100)}%` }} />
        </div>

        {weeklyAverage > 0 && (
          <div className="mt-3 text-xs text-app-muted">
            Media recente: {weeklyAverage.toFixed(1)} km/settimana
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
          Ultime settimane
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
                <div className="text-xs text-app-muted">{week.runs} uscite</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-app-text">{formatKm(week.total_distance)}</div>
                <div className="text-xs text-app-muted">
                  {getWeekLabel(week.runs, weekKm)}
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
function StravaProfileLink() {
  return (
    <Card className="p-3">
      <a
        href="https://www.strava.com/athletes/533234"
        target="_blank"
        rel="noopener noreferrer"
        className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-app-text"
      >
        <ExternalLink size={16} strokeWidth={1.8} />
        <span>Apri profilo Strava</span>
      </a>
    </Card>
  );
}

/**
 * Componente per empty state
 */
function EmptyState() {
  return (
    <Card className="p-8 text-center sm:p-10">
      <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(215,255,63,0.2)] bg-[rgba(215,255,63,0.08)] text-accent-primary">
        <Footprints size={24} strokeWidth={1.8} />
      </div>

      <h2 className="mb-3 text-xl font-semibold text-app-text">Nessuna corsa ancora sincronizzata</h2>

      <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-app-muted">
        Le tue corse appariranno qui automaticamente dopo la prima sincronizzazione con Strava.
        Controlla che il cron job sia attivo o avvia una sync manuale.
      </p>

      <div className="text-xs text-app-muted">
        La sincronizzazione avviene automaticamente ogni 6 ore
      </div>
    </Card>
  );
}

/**
 * Pagina principale della dashboard - Coach at a Glance
 */
export default async function HomePage() {
  // Query per l'ultima corsa con il suo report (ultimo disponibile)
  const lastRun = await getLatestRunWithReport();

  // Query per il trend delle ultime 6 settimane
  const trendQuery = await query(`
    WITH weekly_stats AS (
      SELECT
        DATE_TRUNC('week', start_date) as week_start,
        COUNT(*) as runs,
        SUM(distance_m) as total_distance
      FROM activities
      WHERE type IN ('Run', 'TrailRun')
        AND start_date >= NOW() - INTERVAL '6 weeks'
      GROUP BY DATE_TRUNC('week', start_date)
      ORDER BY week_start DESC
    )
    SELECT
      EXTRACT(WEEK FROM week_start)::INTEGER as week,
      runs,
      total_distance
    FROM weekly_stats
    ORDER BY week_start DESC
    LIMIT 6
  `);

  const athleteSettings = await getAthleteSettings();
  const language = normalizeLanguage(athleteSettings?.language);
  const activityHistoryQuery = await query(`
    SELECT * FROM activities
    WHERE type IN ('Run', 'TrailRun')
      AND start_date >= NOW() - INTERVAL '90 days'
    ORDER BY start_date DESC
  `);

  const athleteMetrics = calculateCoachingMetrics(activityHistoryQuery.rows, athleteSettings);
  const coachingRules = getCoachingRules(athleteMetrics, athleteSettings);
  const weeklyTrend = trendQuery.rows as WeeklyTrendItem[];

  // Query per il report più recente
  const latestReport = lastRun && hasCoachReport(lastRun)
    ? {
        title: lastRun?.title || 'Report Coach',
        summary: lastRun.summary || '',
        risk_level: (lastRun.risk_level || 'medio') as 'basso' | 'medio' | 'alto',
        next_48h: lastRun.next_48h || '',
        suggested_focus: lastRun.suggested_focus || '',
        coach_notes: Array.isArray(lastRun.coach_notes) ? lastRun.coach_notes : [],
        readiness_score: lastRun.readiness_score || 0,
        fatigue_score: lastRun.fatigue_score || 0,
        consistency_score: lastRun.consistency_score || 0,
        weekly_plan: Array.isArray(lastRun.weekly_plan) ? lastRun.weekly_plan : [],
        full_report: lastRun.full_report || '',
      }
    : null;

  const dynamicAthleteState = buildDynamicAthleteState({
    latestRun: lastRun,
    latestReport,
    recentRuns: activityHistoryQuery.rows,
    metrics: athleteMetrics,
    rules: coachingRules,
    language,
  });

  const hasData = lastRun || (weeklyTrend && weeklyTrend.length > 0);

  return (
    <PullToRefresh language={language}>
      <PageShell>
        {/* Header con navigazione */}
        <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary text-black">
                <Activity size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="eyebrow">{t(language, 'dashboard.eyebrow')}</p>
                <h1 className="truncate text-xl font-semibold tracking-tight text-app-text sm:text-2xl">Coach</h1>
              </div>
            </div>
            <p className="mt-2 hidden text-sm text-app-muted sm:block">{t(language, 'dashboard.subtitle')}</p>
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
            <ManualSyncButton language={language} />
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-app-muted sm:flex">
              <UserCircle size={18} strokeWidth={1.8} />
            </div>
          </div>
        </div>

        {!hasData ? (
          <EmptyState />
        ) : (
            <div className="space-y-5 sm:space-y-6">
            {/* Hero Section */}
            <HeroSection lastRun={lastRun} />

            {/* Layout principale */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
              {/* Colonna sinistra - Coach Decision (principale) */}
              <div className="space-y-5 lg:col-span-2">
                <CoachDecisionCard state={dynamicAthleteState} language={language} />
                <LastRunCard run={lastRun} />
              </div>

              {/* Colonna destra - Metriche e trend */}
              <div className="space-y-5 lg:col-span-1">
                <AthleteMetricsCard metrics={dynamicAthleteState} />
                <WeeklyTrendCard trend={weeklyTrend} />
                <StravaProfileLink />
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </PullToRefresh>
  );
}
