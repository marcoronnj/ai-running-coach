import Link from 'next/link';
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
  User,
} from 'lucide-react';
import { query } from '@/lib/db';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { buildDynamicAthleteState, type DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import { getLatestRunWithReport } from '@/lib/runs';
import { formatDateIT } from '@/lib/date-utils';
import { getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';
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
 * Componente per il profilo atleta
 */
function AthleteProfileCard({ settings }: { settings: any }) {
  if (!settings) return null;

  return (
    <Card>
      <SectionHeader eyebrow="profile" title="Profilo atleta" icon={User} />

      <div className="space-y-3">
        {settings.profile_summary && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">Sommario</div>
            <div className="text-sm text-app-text">{settings.profile_summary}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {settings.age && (
            <div className="metric-card p-3">
              <div className="eyebrow">Età</div>
              <div className="text-lg font-semibold text-app-text">{settings.age}</div>
              <div className="text-xs text-app-muted">anni</div>
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

        {settings.main_goal && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">Obiettivo principale</div>
            <div className="text-sm font-medium text-app-text">{settings.main_goal}</div>
          </div>
        )}

        {settings.experience_level && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">Livello esperienza</div>
            <div className="text-sm text-app-text">{settings.experience_level}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * Componente per le metriche attuali
 */
function CurrentMetricsCard({ metrics, rules }: { metrics: DynamicAthleteState, rules: any }) {
  if (!metrics) return null;

  return (
    <Card>
      <SectionHeader eyebrow="current state" title="Metriche attuali" icon={Gauge} />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <MetricTile label="Readiness" value={metrics.readinessScore ?? 'N/A'} detail={metrics.readinessLabel || 'Readiness'} icon={Activity} tone="lime" progress={metrics.readinessScore} />
        <MetricTile label="Fatigue" value={metrics.fatigueScore ?? 'N/A'} detail={metrics.fatigueLabel || 'Fatigue'} icon={Moon} tone="warning" progress={metrics.fatigueScore} />
        <MetricTile label="Consistency" value={metrics.consistencyScore ?? 'N/A'} detail={metrics.consistencyLabel || 'Consistency'} icon={TrendingUp} tone="cyan" progress={metrics.consistencyScore} />
        <div className="metric-card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Overload</p>
            <IconBox icon={ShieldAlert} tone={metrics.overloadRisk === 'alto' ? 'danger' : metrics.overloadRisk === 'medio' ? 'warning' : 'success'} />
          </div>
          <div className="text-lg font-semibold capitalize text-app-text">{metrics.overloadRisk}</div>
          <span className={cn('mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold capitalize', riskTone(metrics.overloadRisk))}>{metrics.overloadRisk}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3">
        {metrics.explanation && (
          <div className="metric-card p-3">
            <div className="eyebrow mb-1">Spiegazione dinamica</div>
            <div className="text-sm text-app-text">{metrics.explanation}</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div>
          <div className="eyebrow mb-1">Focus consigliato</div>
          <div className="text-sm font-medium text-app-text">{metrics.suggestedFocus}</div>
        </div>

        {rules && (
          <div>
            <div className="eyebrow mb-1">Intensità massima</div>
            <div className="text-sm font-medium capitalize text-app-text">{rules.allowedIntensity}</div>
          </div>
        )}

        {rules?.blockedWorkouts && rules.blockedWorkouts.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Avvertenze</div>
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
function WeeklyTrendCard({ trend }: { trend: any[] }) {
  if (!trend || trend.length === 0) return null;
  const maxKm = Math.max(...trend.map((week) => week.total_distance / 1000), 1);

  return (
    <Card>
      <SectionHeader eyebrow="volume" title="Trend ultime 4 settimane" icon={TrendingUp} />

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
                  {week.runs} uscite • {formatKm(week.total_distance)}
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
function LatestReportCard({ report, run }: { report: any; run: any }) {
  if (!run) return null;

  const status = getReportStatus(run);
  const excerpt = getCoachReportExcerpt(report || run);

  if (!report) {
    return (
      <Card>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">latest activity</p>
            <h2 className="text-lg font-semibold text-app-text">Ultima corsa</h2>
            <p className="text-sm text-app-muted">{formatDateIT(run.start_date)}</p>
          </div>
          <ReportStatusBadge status={status} />
        </div>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-base font-semibold text-app-text">{run.name}</div>
            <div className="text-sm text-neutral-300">Analisi AI in attesa di generazione.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <MetricTile label="Distanza" value={formatKm(run.distance_m)} icon={Activity} tone="lime" />
            <MetricTile label="Passo" value={formatPace(run.average_speed)} icon={Gauge} tone="cyan" />
            <MetricTile label="Stato" value="In attesa" icon={Brain} />
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/runs/${run.id}`}
              className="pressable inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-accent-primary to-accent-secondary px-5 py-2.5 text-sm font-bold text-black"
            >
              <ArrowRight size={16} strokeWidth={2} />
              Apri corsa
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
          <h2 className="text-lg font-semibold text-app-text">Ultima corsa</h2>
          <p className="mt-1 text-sm text-app-muted">{formatDateIT(run.start_date)}</p>
        </div>
        <ReportStatusBadge status={status} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-base font-semibold text-app-text">{run.name}</div>
          {report.title && <div className="mb-2 text-sm font-medium text-app-text">{report.title}</div>}
          <div className="text-sm leading-relaxed text-neutral-300">{excerpt}</div>
        </div>

        <div className="metric-card p-3.5">
          <div className="eyebrow mb-2">Prossime 48 ore</div>
          <div className="text-sm text-app-text">{report.next_48h}</div>
        </div>

        {report.weekly_plan && report.weekly_plan.length > 0 && (
          <div>
            <div className="eyebrow mb-3">Piano settimanale</div>
            <div className="space-y-2">
              {report.weekly_plan.slice(0, 3).map((item: any, index: number) => (
                <div key={index} className="rounded-xl bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-app-text">{item.name}</div>
                    <div className="text-xs capitalize text-app-muted">{item.intensity}</div>
                  </div>
                  <div className="text-sm text-neutral-300 mt-1">{item.description}</div>
                  <div className="text-xs text-neutral-500 mt-1">{item.duration}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.coach_notes && report.coach_notes.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Note coach</div>
            <ul className="space-y-1">
              {report.coach_notes.map((note: string, index: number) => (
                <li key={index} className="flex gap-2 text-sm text-accent-secondary"><Sparkles size={15} strokeWidth={1.8} /> {note}</li>
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
      <div className="mb-5 flex items-start gap-3">
        <IconBox icon={state.hasRunToday ? Check : Brain} tone={state.hasRunToday ? 'success' : 'cyan'} />
        <div className="flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-app-text">
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
    const athleteSettings = await getAthleteSettings();
    const language = normalizeLanguage(athleteSettings?.language);

    // Ottieni storico ultime 90 giorni per metriche
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const activitiesQuery = await query(
      `SELECT * FROM activities
       WHERE type IN ('Run', 'TrailRun')
       AND start_date >= $1
       ORDER BY start_date DESC`,
      [ninetyDaysAgo.toISOString()]
    );

    // Calcola metriche e regole
    const metrics = calculateCoachingMetrics(activitiesQuery.rows, athleteSettings);
    const rules = getCoachingRules(metrics, athleteSettings);

    // Ottieni trend ultime 4 settimane
    const trendQuery = await query(`
      WITH weekly_stats AS (
        SELECT
          DATE_TRUNC('week', start_date) as week_start,
          COUNT(*) as runs,
          SUM(distance_m) as total_distance
        FROM activities
        WHERE type IN ('Run', 'TrailRun')
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

    const latestRun = await getLatestRunWithReport();
    const reportStatus = getReportStatus(latestRun);
    const weeklyTrend = trendQuery.rows;
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

    const dynamicAthleteState = buildDynamicAthleteState({
      latestRun,
      latestReport,
      recentRuns: activitiesQuery.rows,
      metrics,
      rules,
      language,
    });

    return (
      <PageShell>
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow mb-1">{t(language, 'coach.eyebrow')}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-app-text sm:text-3xl">AI Running Coach</h1>
              <p className="mt-1 text-sm text-app-muted">{t(language, 'coach.subtitle')}</p>
              {latestRun ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-app-muted">Ultima corsa: {formatDateIT(latestRun.start_date)}</span>
                  <ReportStatusBadge status={reportStatus} />
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
              <AthleteProfileCard settings={athleteSettings} />
              <CurrentMetricsCard metrics={dynamicAthleteState} rules={rules} />
            </div>

            {/* Colonna destra - Trend e report */}
            <div className="space-y-5 lg:col-span-2">
              <CoachDecisionCard state={dynamicAthleteState} language={language} />
              <WeeklyTrendCard trend={weeklyTrend} />
              <LatestReportCard report={latestReport} run={latestRun} />
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

          <h2 className="mb-3 text-xl font-semibold text-app-text">Errore di caricamento</h2>

          <p className="mb-6 text-sm leading-relaxed text-app-muted">
            Si è verificato un errore nel caricamento dei dati del coach.
            Controlla la connessione al database e riprova.
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
