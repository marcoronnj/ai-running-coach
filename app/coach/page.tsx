import Link from 'next/link';
import Image from 'next/image';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ExternalLink,
  Gauge,
  Moon,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { query } from '@/lib/db';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { calculateAge } from '@/lib/age';
import { verifySession } from '@/lib/auth';
import { buildDynamicAthleteState, type DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import { getLatestRunWithReport } from '@/lib/runs';
import { formatDateLocalized } from '@/lib/date-utils';
import { containsItalianText, getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';
import { getRecoveryTimelineState } from '@/lib/recovery-timeline';
import { getPublicStravaConnectionStatus, type PublicStravaConnectionStatus } from '@/lib/strava-connection';
import { fallbackDynamicAthleteState, logServerError, safeResolve } from '@/lib/resilient-data';
import ManualSyncButton from '@/app/components/ManualSyncButton';
import { Badge, Card, IconBox, MetricTile, PageShell, SectionHeader, cn, riskTone } from '@/app/components/ui';
import { normalizeLanguage, t, type Language } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * Helper: Formatta chilometri
 */
function formatKm(meters: number): string {
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

function formatPace(speedMs: number): string {
  if (!speedMs || speedMs <= 0) return 'N/A';
  const secondsPerKm = 1000 / speedMs;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
}

function getReportStatus(run?: { title?: string; summary?: string; full_report?: string } | null): 'ready' | 'waiting' {
  return hasCoachReport(run) ? 'ready' : 'waiting';
}

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

function ReportStatusBadge({ status, language }: { status: 'ready' | 'waiting'; language: Language }) {
  return (
    <Badge tone={status === 'ready' ? 'success' : 'warning'}>
      {t(language, status === 'ready' ? 'report.ready' : 'report.pending')}
    </Badge>
  );
}

function AthleteAvatar({ status, size = 'lg' }: { status?: PublicStravaConnectionStatus; size?: 'md' | 'lg' }) {
  const athlete = status?.athlete;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ').trim();
  const image = athlete?.profileMedium || athlete?.profile;
  const initials = fullName
    ? fullName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
    : '';
  const className = size === 'lg'
    ? 'h-12 w-12 rounded-2xl text-base'
    : 'h-9 w-9 rounded-xl text-sm';

  if (image) {
    return (
      <img
        src={image}
        alt={fullName || 'Strava athlete'}
        width={size === 'lg' ? 48 : 36}
        height={size === 'lg' ? 48 : 36}
        className={`${className} shrink-0 border border-[rgba(54,252,225,0.32)] object-cover shadow-[0_0_22px_rgba(54,252,225,0.14)]`}
      />
    );
  }

  return (
    <div className={`${className} flex shrink-0 items-center justify-center border border-[rgba(54,252,225,0.32)] bg-white/[0.05] font-bold text-accent-primary shadow-[0_0_22px_rgba(54,252,225,0.14)]`}>
      {initials || 'A'}
    </div>
  );
}

/**
 * Componente per il profilo atleta
 */
function localizedFreeText(value: string | null | undefined, language: Language, fallback: string): string | null {
  if (!value) return null;
  if (language === 'en' && containsItalianText(value)) return fallback;
  return value;
}

function getExperienceLabel(value: string | null | undefined, language: Language): string | null {
  if (!value) return null;
  if (language !== 'en') return value;

  const normalized = value.toLowerCase();
  if (normalized.includes('principiante') || normalized.includes('beginner')) return 'Beginner';
  if (normalized.includes('intermedio') || normalized.includes('intermediate')) return 'Intermediate';
  if (normalized.includes('avanzato') || normalized.includes('advanced')) return 'Advanced';
  if (containsItalianText(value)) return 'Saved before current language setting';
  return value;
}

function getReportText(value: string | null | undefined, language: Language, fallback: string): string | null {
  if (!value) return null;
  if (language === 'en' && containsItalianText(value)) return fallback;
  return value;
}

function getWeeklyPlanItem(
  item: { name?: string; description?: string; duration?: string; intensity?: string },
  language: Language,
) {
  if (language !== 'en') return item;

  const hasItalian = [item.name, item.description, item.duration].some((value) => value && containsItalianText(value));
  if (!hasItalian) return item;

  return {
    ...item,
    name: 'Historical workout',
    description: 'This plan was generated before the current language setting. Use the live coach for current guidance.',
    duration: '',
  };
}

function AthleteProfileCard({ settings, language, stravaStatus }: { settings: any; language: Language; stravaStatus?: PublicStravaConnectionStatus }) {
  if (!settings) return null;
  const athlete = stravaStatus?.athlete;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ').trim();
  const displayName = fullName || (language === 'en' ? 'Athlete' : 'Atleta');
  const calculatedAge = calculateAge(settings.birth_date);
  const profileSummary = localizedFreeText(
    settings.profile_summary,
    language,
    'Profile summary saved before the current language setting.',
  );
  const mainGoal = localizedFreeText(
    settings.main_goal,
    language,
    'Main goal saved before the current language setting.',
  );
  const experienceLevel = getExperienceLabel(settings.experience_level, language);

  return (
    <Card>
      <div className="mb-5 flex items-center gap-3">
        <AthleteAvatar status={stravaStatus} />
        <div className="min-w-0">
          <p className="eyebrow mb-1">{language === 'en' ? 'Athlete profile' : 'Profilo atleta'}</p>
          <h2 className="truncate text-lg font-semibold tracking-tight text-app-text">{displayName}</h2>
        </div>
      </div>

      <div className="space-y-3">
        {profileSummary && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">{language === 'en' ? 'Summary' : 'Sommario'}</div>
            <div className="text-sm text-app-text">{profileSummary}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {calculatedAge !== null && (
            <div className="metric-card p-3">
              <div className="eyebrow">{language === 'en' ? 'Age' : 'Età'}</div>
              <div className="text-lg font-semibold text-app-text">{calculatedAge}</div>
              <div className="text-xs text-app-muted">{language === 'en' ? 'years old' : 'anni'}</div>
            </div>
          )}

          {settings.weight_kg && settings.height_cm && (
            <div className="metric-card p-3">
              <div className="eyebrow">BMI</div>
              <div className="text-lg font-semibold text-app-text">
                {(settings.weight_kg / ((settings.height_cm / 100) ** 2)).toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {mainGoal && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">{language === 'en' ? 'Main goal' : 'Obiettivo principale'}</div>
            <div className="text-sm font-medium text-app-text">{mainGoal}</div>
          </div>
        )}

        {experienceLevel && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">{language === 'en' ? 'Experience level' : 'Livello esperienza'}</div>
            <div className="text-sm text-app-text">{experienceLevel}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Componente per le metriche attuali
 */
function CurrentMetricsCard({ metrics, rules, language }: { metrics: DynamicAthleteState, rules: any; language: Language }) {
  if (!metrics) return null;

  return (
    <Card>
      <SectionHeader eyebrow="current state" title={language === 'en' ? 'Current metrics' : 'Metriche attuali'} icon={Gauge} />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MetricTile label="Readiness" value={metrics.readinessScore ?? 'N/A'} detail={metrics.readinessLabel || 'Readiness'} icon={Activity} tone="lime" progress={metrics.readinessScore} />
        <MetricTile label="Fatigue" value={metrics.fatigueScore ?? 'N/A'} detail={metrics.fatigueLabel || 'Fatigue'} icon={Moon} tone="warning" progress={metrics.fatigueScore} />
        <MetricTile label="Consistency" value={metrics.consistencyScore ?? 'N/A'} detail={metrics.consistencyLabel || 'Consistency'} icon={TrendingUp} tone="cyan" progress={metrics.consistencyScore} />
        <div className="metric-card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Overload</p>
            <IconBox icon={ShieldAlert} tone={metrics.overloadRisk === 'alto' ? 'danger' : metrics.overloadRisk === 'medio' ? 'warning' : 'success'} />
          </div>
          <div className="text-lg font-semibold capitalize text-app-text">{getRiskLabel(metrics.overloadRisk, language)}</div>
          <span className={cn('mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold capitalize', riskTone(metrics.overloadRisk))}>{getRiskLabel(metrics.overloadRisk, language)}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3">
        {metrics.explanation && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">{language === 'en' ? 'Dynamic explanation' : 'Spiegazione dinamica'}</div>
            <div className="text-sm text-app-text">{metrics.explanation}</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="eyebrow mb-1">{language === 'en' ? 'Suggested focus' : 'Focus consigliato'}</div>
          <div className="text-sm font-medium text-app-text">{metrics.suggestedFocus}</div>
        </div>

        {rules && (
          <div>
            <div className="eyebrow mb-1">{language === 'en' ? 'Max intensity' : 'Intensità massima'}</div>
            <div className="text-sm font-medium capitalize text-app-text">{rules.allowedIntensity}</div>
          </div>
        )}

        {rules?.blockedWorkouts && rules.blockedWorkouts.length > 0 && (
          <div>
            <div className="eyebrow mb-2">{language === 'en' ? 'Warnings' : 'Avvertenze'}</div>
            <ul className="space-y-1">
              {rules.blockedWorkouts.map((warning: string, index: number) => (
                <li key={index} className="flex gap-2 text-sm text-[var(--warning)]"><ShieldAlert size={15} strokeWidth={1.8} /> {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Componente per il trend delle ultime settimane
 */
function WeeklyTrendCard({ trend, language }: { trend: any[]; language: Language }) {
  if (!trend || trend.length === 0) return null;
  const maxKm = Math.max(...trend.map((week) => week.total_distance / 1000), 1);

  return (
    <Card>
      <SectionHeader eyebrow="volume" title={language === 'en' ? 'Last 4 weeks trend' : 'Trend ultime 4 settimane'} icon={TrendingUp} />

      <div className="space-y-2.5">
        {trend.map((week, index) => (
          <div key={index} className="grid grid-cols-[2rem_1fr_auto] items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-xs font-semibold text-app-muted">
              {week.week}
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary" style={{ width: `${Math.min(100, ((week.total_distance / 1000) / maxKm) * 100)}%` }} />
                </div>
                <div className="text-xs text-app-muted">
                  {week.runs} {language === 'en' ? 'runs' : 'uscite'} • {formatKm(week.total_distance)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-semibold text-app-text">{formatKm(week.total_distance)}</div>
              <div className="text-xs text-app-muted">km</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * Componente per l'ultimo report
 */
function LatestReportCard({ report, run, language }: { report: any; run: any; language: Language }) {
  if (!run) return null;

  const status = getReportStatus(run);
  const excerpt = getCoachReportExcerpt({ ...(report || {}), ...run }, 220, language);
  const runName = getReportText(run.name, language, language === 'en' ? 'Latest run' : run.name) || run.name;
  const reportTitle = getReportText(report?.title, language, 'Historical run analysis');
  const recoveryTimeline = getRecoveryTimelineState({
    runDate: run.start_date,
    distanceMeters: run.distance_m,
    readinessScore: report?.readiness_score,
    fatigueScore: report?.fatigue_score,
    overloadRisk: report?.risk_level,
    focus: report?.suggested_focus,
    language,
  });
  const next48h = recoveryTimeline.next48h || getReportText(report?.next_48h, language, 'Use the live coach for current recovery guidance.');

  if (!report) {
    return (
      <Card>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t(language, 'dashboard.latestActivity')}</p>
            <h2 className="text-lg font-semibold text-app-text">{t(language, 'dashboard.latestRun')}</h2>
            <p className="text-sm text-app-muted">{formatDateLocalized(run.start_date, language)}</p>
          </div>
          <ReportStatusBadge status={status} language={language} />
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-base font-semibold text-app-text">{runName}</div>
            <div className="text-sm text-neutral-300">{t(language, 'dashboard.aiAnalysisPending')}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile label={t(language, 'dashboard.distance')} value={formatKm(run.distance_m)} icon={Activity} tone="lime" />
            <MetricTile label={language === 'en' ? 'Pace' : 'Passo'} value={formatPace(run.average_speed)} icon={Gauge} tone="cyan" />
            <MetricTile label={language === 'en' ? 'Status' : 'Stato'} value={language === 'en' ? 'Pending' : 'In attesa'} icon={Brain} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/runs/${run.id}`}
              className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 py-2.5 text-sm font-bold text-black"
            >
              <ArrowRight size={16} strokeWidth={2} />
              {language === 'en' ? 'Open run' : 'Apri corsa'}
            </Link>
            {run.strava_id && (
              <a
                href={`https://www.strava.com/activities/${run.strava_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 py-2.5 text-sm font-semibold text-app-text"
              >
                <ExternalLink size={16} strokeWidth={1.8} />
                Strava
              </a>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">latest report</p>
          <h2 className="text-lg font-semibold text-app-text">{t(language, 'dashboard.latestRun')}</h2>
          <p className="mt-1 text-sm text-app-muted">{formatDateLocalized(run.start_date, language)}</p>
        </div>
        <ReportStatusBadge status={status} language={language} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-base font-semibold text-app-text">{runName}</div>
          {reportTitle && <div className="mb-2 text-sm font-medium text-app-text">{reportTitle}</div>}
          <div className="text-sm leading-relaxed text-neutral-300">{excerpt}</div>
        </div>

        <div className="metric-card p-3.5">
          <div className="eyebrow mb-2">{language === 'en' ? 'Next 48 hours' : 'Prossime 48 ore'}</div>
          <div className="text-sm text-app-text">{next48h}</div>
        </div>

        {report.weekly_plan && report.weekly_plan.length > 0 && (
          <div>
            <div className="eyebrow mb-3">{language === 'en' ? 'Weekly plan' : 'Piano settimanale'}</div>
            <div className="space-y-2">
              {report.weekly_plan.slice(0, 3).map((rawItem: any, index: number) => {
                const item = getWeeklyPlanItem(rawItem, language);

                return (
                  <div key={index} className="rounded-xl bg-white/[0.035] p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-app-text">{item.name}</div>
                      <div className="text-xs capitalize text-app-muted">{item.intensity}</div>
                    </div>
                    <div className="mt-1 text-sm text-neutral-300">{item.description}</div>
                    {item.duration ? <div className="mt-1 text-xs text-neutral-500">{item.duration}</div> : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {report.coach_notes && report.coach_notes.length > 0 && (
          <div>
            <div className="eyebrow mb-2">{language === 'en' ? 'Coach notes' : 'Note coach'}</div>
            <ul className="space-y-1">
              {report.coach_notes.map((note: string, index: number) => (
                <li key={index} className="flex gap-2 text-sm text-accent-secondary"><Sparkles size={15} strokeWidth={1.8} /> {getReportText(note, language, 'Historical coach note generated before the current language setting.')}</li>
              ))}
            </ul>
          </div>
        )}
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
        icon={state.hasRunToday ? Check : Brain}
        action={<Badge tone="cyan">{state.recoveryStatus}</Badge>}
        className="mb-3 items-start"
      />

      <p className="mb-4 text-[13px] leading-5 text-neutral-300">
        {state.explanation}
      </p>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="metric-card p-3.5">
          <div className="eyebrow mb-1">{t(language, 'dashboard.today')}</div>
          <p className="text-sm text-app-text">
            {state.todayAction}
          </p>
        </div>

        <div className="metric-card p-3.5">
          <div className="eyebrow mb-1">{t(language, 'dashboard.tomorrow')}</div>
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
 * Pagina coach principale
 */
export default async function CoachPage() {
  try {
    // Ottieni impostazioni atleta
    const athleteSettings = await safeResolve('coach.athleteSettings', getAthleteSettings, null);
    const language = normalizeLanguage(athleteSettings?.language);
    const session = await safeResolve('coach.session', verifySession, null);
    const stravaStatus = session
      ? await safeResolve('coach.stravaStatus', () => getPublicStravaConnectionStatus(session.email), undefined)
      : undefined;

    // Ottieni storico ultime 90 giorni per metriche
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const activities = await safeResolve('coach.activities', async () => {
      const result = await query(
      `SELECT * FROM activities
       WHERE start_date >= $1
       ORDER BY start_date DESC`,
      [ninetyDaysAgo.toISOString()]
      );
      return result.rows;
    }, []);

    // Calcola metriche e regole
    let metrics: ReturnType<typeof calculateCoachingMetrics> | null = null;
    let rules: ReturnType<typeof getCoachingRules> | null = null;

    try {
      metrics = calculateCoachingMetrics(activities, athleteSettings);
      rules = getCoachingRules(metrics, athleteSettings);
    } catch (error) {
      logServerError('coach.coachingMetrics', error);
    }

    // Ottieni trend ultime 4 settimane
    const weeklyTrend = await safeResolve('coach.weeklyTrend', async () => {
      const result = await query(`
      WITH weekly_stats AS (
        SELECT
          DATE_TRUNC('week', start_date) as week_start,
          COUNT(*) as runs,
          SUM(distance_m) as total_distance
        FROM activities
        WHERE COALESCE(sport_type, type) IN ('Run', 'TrailRun', 'VirtualRun')
          AND start_date >= NOW() - INTERVAL '4 weeks'
        GROUP BY DATE_TRUNC('week', start_date)
        ORDER BY week_start DESC
      )
      SELECT
        EXTRACT(WEEK FROM week_start)::INTEGER as week,
        runs,
        total_distance
      FROM weekly_stats
      ORDER BY week_start DESC
      LIMIT 4
    `);
      return result.rows;
    }, []);

    const latestRun = await safeResolve('coach.latestRun', getLatestRunWithReport, null);
    const reportStatus = getReportStatus(latestRun);
    const latestReport = latestRun && hasCoachReport(latestRun)
      ? ({
          title: latestRun?.title || 'Report Coach',
          summary: latestRun.summary || '',
          risk_level: (latestRun.risk_level || 'medio') as 'basso' | 'medio' | 'alto',
          next_48h: latestRun.next_48h || '',
          suggested_focus: latestRun.suggested_focus || '',
          coach_notes: Array.isArray(latestRun.coach_notes) ? latestRun.coach_notes : [],
          readiness_score: latestRun.readiness_score || 0,
          fatigue_score: latestRun.fatigue_score || 0,
          consistency_score: latestRun.consistency_score || 0,
          weekly_plan: Array.isArray(latestRun.weekly_plan) ? latestRun.weekly_plan : [],
          full_report: latestRun.full_report || '',
        } as any)
      : null;

    let dynamicAthleteState = fallbackDynamicAthleteState(language);

    try {
      dynamicAthleteState = buildDynamicAthleteState({
        latestRun,
        latestReport,
        recentRuns: activities,
        metrics,
        rules,
        language,
      });
    } catch (error) {
      logServerError('coach.dynamicAthleteState', error);
    }

    return (
      <PageShell>
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow mb-1">{t(language, 'coach.eyebrow')}</p>
              <Image
                src="/logo.svg"
                alt="Veiro"
                width={80}
                height={30}
                priority
                className="block h-6 w-auto sm:h-[30px]"
              />
              <p className="mt-1 text-sm text-app-muted">{t(language, 'coach.subtitle')}</p>
              {latestRun ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-app-muted">{t(language, 'dashboard.lastRun')}: {formatDateLocalized(latestRun.start_date, language)}</span>
                  <ReportStatusBadge status={reportStatus} language={language} />
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="pressable inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-sm font-semibold text-app-text"
              >
                <ArrowLeft size={16} strokeWidth={1.8} />
                {t(language, 'nav.dashboard')}
              </Link>
              <ManualSyncButton language={language} />
            </div>
          </div>

          {/* Grid principale */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
            {/* Colonna sinistra - Profilo e metriche */}
            <div className="space-y-5 lg:col-span-1">
              <AthleteProfileCard settings={athleteSettings} language={language} stravaStatus={stravaStatus} />
              <CurrentMetricsCard metrics={dynamicAthleteState} rules={rules} language={language} />
            </div>

            {/* Colonna destra - Trend e report */}
            <div className="space-y-5 lg:col-span-2">
              <CoachDecisionCard state={dynamicAthleteState} language={language} />
              <WeeklyTrendCard trend={weeklyTrend} language={language} />
              <LatestReportCard report={latestReport} run={latestRun} language={language} />
            </div>
          </div>
      </PageShell>
    );
  } catch (error) {
    console.error('Errore caricamento pagina coach:', error);

    return (
      <PageShell className="flex items-center justify-center">
        <Card className="max-w-md text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,98,98,0.2)] bg-[rgba(255,98,98,0.1)] text-[var(--danger)]">
            <ShieldAlert size={24} strokeWidth={1.8} />
          </div>

          <h2 className="mb-3 text-xl font-semibold text-app-text">Dati temporaneamente non disponibili</h2>

          <p className="mb-6 text-sm leading-relaxed text-app-muted">
            Veiro non è riuscita a preparare questa vista. Torna alla dashboard e riprova tra poco.
          </p>

          <Link
            href="/"
            className="pressable inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-4 py-2.5 text-sm font-bold text-black"
          >
            <ArrowLeft size={16} strokeWidth={2} />
            Torna alla Dashboard
          </Link>
        </Card>
      </PageShell>
    );
  }
}
