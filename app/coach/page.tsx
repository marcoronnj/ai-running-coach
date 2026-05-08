import Link from 'next/link';
import { query } from '@/lib/db';
import { calculateCoachingMetrics } from '@/lib/coaching-metrics';
import { getCoachingRules } from '@/lib/coaching-rules';
import { getAthleteSettings } from '@/lib/athlete-settings';
import { buildDynamicAthleteState, type DynamicAthleteState } from '@/lib/dynamic-athlete-state';
import { getLatestRunWithReport } from '@/lib/runs';
import { formatDateIT } from '@/lib/date-utils';
import { getCoachReportExcerpt, hasCoachReport } from '@/lib/report-display';
import ManualSyncButton from '@/app/components/ManualSyncButton';

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
  const styles = {
    ready: 'bg-emerald-500/10 text-emerald-300',
    waiting: 'bg-yellow-500/10 text-yellow-300',
  };
  const labels = {
    ready: 'Report pronto',
    waiting: 'Report in attesa',
  };

  return (
    <span className={`rounded-full px-3 py-1 ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

/**
 * Helper: Ottieni emoji per score
 */
function getScoreEmoji(score: number | null): string {
  if (score === null) return '⚪';
  if (score >= 80) return '🟢';
  if (score >= 60) return '🟡';
  return '🔴';
}

/**
 * Helper: Ottieni colore per score
 */
function getScoreColor(score: number | null): string {
  if (score === null) return 'text-neutral-400';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

/**
 * Componente per il profilo atleta
 */
function AthleteProfileCard({ settings }: { settings: any }) {
  if (!settings) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-6">Profilo Atleta</h2>

      <div className="space-y-4">
        {settings.profile_summary && (
          <div>
            <div className="text-sm text-neutral-400 mb-1">Sommario</div>
            <div className="text-white">{settings.profile_summary}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {settings.age && (
            <div>
              <div className="text-sm text-neutral-400">Età</div>
              <div className="text-white font-medium">{settings.age} anni</div>
            </div>
          )}

          {settings.weight_kg && settings.height_cm && (
            <div>
              <div className="text-sm text-neutral-400">BMI</div>
              <div className="text-white font-medium">
                {(settings.weight_kg / ((settings.height_cm / 100) ** 2)).toFixed(1)}
              </div>
            </div>
          )}
        </div>

        {settings.main_goal && (
          <div>
            <div className="text-sm text-neutral-400 mb-1">Obiettivo Principale</div>
            <div className="text-white font-medium">{settings.main_goal}</div>
          </div>
        )}

        {settings.experience_level && (
          <div>
            <div className="text-sm text-neutral-400 mb-1">Livello Esperienza</div>
            <div className="text-white">{settings.experience_level}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente per le metriche attuali
 */
function CurrentMetricsCard({ metrics, rules }: { metrics: DynamicAthleteState, rules: any }) {
  if (!metrics) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-6">Metriche Attuali</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">{getScoreEmoji(metrics.readinessScore)}</div>
          <div className={`text-xl font-bold ${getScoreColor(metrics.readinessScore)}`}>
            {metrics.readinessScore ?? 'N/A'}
          </div>
          <div className="text-xs text-neutral-400">{metrics.readinessLabel || 'Readiness'}</div>
        </div>

        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">😴</div>
          <div className={`text-xl font-bold ${getScoreColor(metrics.fatigueScore === null ? null : 100 - metrics.fatigueScore)}`}>
            {metrics.fatigueScore ?? 'N/A'}
          </div>
          <div className="text-xs text-neutral-400">{metrics.fatigueLabel || 'Fatigue'}</div>
        </div>

        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <div className={`text-xl font-bold ${getScoreColor(metrics.consistencyScore)}`}>
            {metrics.consistencyScore ?? 'N/A'}
          </div>
          <div className="text-xs text-neutral-400">{metrics.consistencyLabel || 'Consistency'}</div>
        </div>

        <div className="bg-neutral-800 rounded-xl p-4 text-center">
          <div className="text-2xl mb-2">
            {metrics.overloadRisk === 'alto' ? '🔴' : metrics.overloadRisk === 'medio' ? '🟡' : '🟢'}
          </div>
          <div className="text-sm font-bold text-white uppercase">
            {metrics.overloadRisk}
          </div>
          <div className="text-xs text-neutral-400">Overload</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {metrics.explanation && (
          <div className="bg-neutral-800 rounded-xl p-4">
            <div className="text-sm text-neutral-400 mb-1">Spiegazione dinamica</div>
            <div className="text-white text-sm">{metrics.explanation}</div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-sm text-neutral-400 mb-1">Focus Consigliato</div>
          <div className="text-white font-medium">{metrics.suggestedFocus}</div>
        </div>

        {rules && (
          <div>
            <div className="text-sm text-neutral-400 mb-1">Intensità Massima</div>
            <div className="text-white font-medium capitalize">{rules.allowedIntensity}</div>
          </div>
        )}

        {rules?.blockedWorkouts && rules.blockedWorkouts.length > 0 && (
          <div>
            <div className="text-sm text-neutral-400 mb-2">Avvertenze</div>
            <ul className="space-y-1">
              {rules.blockedWorkouts.map((warning: string, index: number) => (
                <li key={index} className="text-yellow-400 text-sm">⚠️ {warning}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente per il trend delle ultime settimane
 */
function WeeklyTrendCard({ trend }: { trend: any[] }) {
  if (!trend || trend.length === 0) return null;

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <h2 className="text-2xl font-bold text-white mb-6">Trend Ultime 4 Settimane</h2>

      <div className="space-y-3">
        {trend.map((week, index) => (
          <div key={index} className="flex items-center justify-between py-3 px-4 bg-neutral-800 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-neutral-700 rounded-lg flex items-center justify-center text-sm font-medium text-white">
                {week.week}
              </div>
              <div>
                <div className="text-white font-medium">Settimana {week.week}</div>
                <div className="text-sm text-neutral-400">
                  {week.runs} uscite • {formatKm(week.total_distance)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold text-white">{formatKm(week.total_distance)}</div>
              <div className="text-sm text-neutral-400">km</div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Ultima Corsa</h2>
            <p className="text-neutral-400">{formatDateIT(run.start_date)}</p>
          </div>
          <ReportStatusBadge status={status} />
        </div>

        <div className="space-y-4">
          <div>
            <div className="text-lg font-bold text-white mb-2">{run.name}</div>
            <div className="text-neutral-300">Analisi AI in attesa di generazione.</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-sm text-neutral-400 mb-1">Distanza</div>
              <div className="text-white font-semibold">{formatKm(run.distance_m)}</div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-sm text-neutral-400 mb-1">Passo</div>
              <div className="text-white font-semibold">{formatPace(run.average_speed)}</div>
            </div>
            <div className="bg-neutral-800 rounded-xl p-4">
              <div className="text-sm text-neutral-400 mb-1">Stato</div>
              <div className="text-white font-semibold">Report in attesa</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/runs/${run.id}`}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Apri corsa
            </Link>
            {run.strava_id && (
              <a
                href={`https://www.strava.com/activities/${run.strava_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-orange-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
              >
                Strava
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Ultima Corsa</h2>
          <p className="text-neutral-400 mt-1">{formatDateIT(run.start_date)}</p>
        </div>
        <ReportStatusBadge status={status} />
      </div>

      <div className="space-y-4">
        <div>
          <div className="text-lg font-bold text-white mb-2">{run.name}</div>
          {report.title && <div className="text-white font-medium mb-2">{report.title}</div>}
          <div className="text-neutral-300 leading-relaxed">{excerpt}</div>
        </div>

        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="text-sm text-neutral-400 mb-2">Prossime 48 ore</div>
          <div className="text-white">{report.next_48h}</div>
        </div>

        {report.weekly_plan && report.weekly_plan.length > 0 && (
          <div>
            <div className="text-sm text-neutral-400 mb-3">Piano Settimanale</div>
            <div className="space-y-2">
              {report.weekly_plan.slice(0, 3).map((item: any, index: number) => (
                <div key={index} className="bg-neutral-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-white font-medium">{item.name}</div>
                    <div className="text-sm text-neutral-400 capitalize">{item.intensity}</div>
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
            <div className="text-sm text-neutral-400 mb-2">Note Coach</div>
            <ul className="space-y-1">
              {report.coach_notes.map((note: string, index: number) => (
                <li key={index} className="text-blue-400 text-sm">💡 {note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Componente Coach Decision Card - Nuova card principale del coach
 */
function CoachDecisionCard({ state }: { state: DynamicAthleteState }) {
  return (
    <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800">
      <div className="flex items-start gap-4 mb-6">
        <div className="text-4xl flex-shrink-0">
          {state.hasRunToday ? '✅' : '🧠'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-white">
              Stato atleta dinamico
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-neutral-800 text-blue-300 capitalize">
              {state.recoveryStatus}
            </span>
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed">
            {state.explanation}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="text-sm text-neutral-400 mb-1">Oggi</div>
          <p className="text-white text-sm">
            {state.todayAction}
          </p>
        </div>

        <div className="bg-neutral-800 rounded-xl p-4">
          <div className="text-sm text-neutral-400 mb-1">Domani</div>
          <p className="text-white text-sm">
            {state.tomorrowAction}
          </p>
        </div>
      </div>

      <div className="bg-neutral-800 rounded-xl p-4 mb-4">
        <div className="text-sm text-neutral-400 mb-1">
          Dopodomani / Prossima corsa
        </div>
        <p className="text-white text-sm">
          {state.nextAction}
        </p>
      </div>

      <div className="space-y-3">
        {state.timeline.map((item, index) => (
          <div key={`${item.label}-${index}`} className="flex gap-3 rounded-xl bg-neutral-800/70 p-4">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${item.completed ? 'bg-emerald-500/15 text-emerald-300' : 'bg-neutral-700 text-neutral-300'}`}>
              {item.completed ? '✓' : index + 1}
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-400">{item.label}</div>
              <div className="text-sm font-semibold text-white">{item.title}</div>
              <div className="text-sm text-neutral-300">{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Pagina coach principale
 */
export default async function CoachPage() {
  try {
    // Ottieni impostazioni atleta
    const athleteSettings = await getAthleteSettings();

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
    });

    return (
      <div className="min-h-screen bg-neutral-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">AI Running Coach</h1>
              <p className="text-neutral-400">Analisi completa del tuo stato di forma</p>
              {latestRun ? (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-neutral-400">Ultima corsa: {formatDateIT(latestRun.start_date)}</span>
                  <ReportStatusBadge status={reportStatus} />
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-xl transition-colors duration-200 text-sm"
              >
                ← Dashboard
              </Link>
              <ManualSyncButton />
            </div>
          </div>

          {/* Grid principale */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Colonna sinistra - Profilo e metriche */}
            <div className="lg:col-span-1 space-y-8">
              <AthleteProfileCard settings={athleteSettings} />
              <CurrentMetricsCard metrics={dynamicAthleteState} rules={rules} />
            </div>

            {/* Colonna destra - Trend e report */}
            <div className="lg:col-span-2 space-y-8">
              <CoachDecisionCard state={dynamicAthleteState} />
              <WeeklyTrendCard trend={weeklyTrend} />
              <LatestReportCard report={latestReport} run={latestRun} />
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('Errore caricamento pagina coach:', error);

    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="bg-neutral-900 rounded-3xl p-8 border border-neutral-800 text-center max-w-md">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl">⚠️</span>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Errore di caricamento</h2>

          <p className="text-neutral-400 mb-6">
            Si è verificato un errore nel caricamento dei dati del coach.
            Controlla la connessione al database e riprova.
          </p>

          <Link
            href="/"
            className="inline-flex items-center justify-center w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors duration-200"
          >
            Torna alla Dashboard
          </Link>
        </div>
      </div>
    );
  }
}
